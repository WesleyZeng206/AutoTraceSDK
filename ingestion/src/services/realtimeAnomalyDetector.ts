import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';

/**
 * Anomaly severity levels
 */
export type SeverityLevel = 'info' | 'warning' | 'critical';

export type MetricType = 'avg_latency' | 'error_rate';

interface TimeBucketData {
  time_bucket: Date;
  request_count: number;
  avg_latency: number;
  stddev_latency: number | null;
  error_rate: number;
}


interface RouteMetrics {
  team_id: string;
  service_name: string;
  route: string;
  timeBuckets: TimeBucketData[];
}


export interface AnomalyResult {
  id: string;
  team_id: string;
  service_name: string;
  route: string;
  time_bucket: string;
  metric: MetricType;
  score: number;
  severity: SeverityLevel;
  baseline_mean: number;
  baseline_std: number | null;
  created_at: string;
}


export interface DetectionParams {
  teamId: string;
  startTime: Date;
  endTime: Date;
  windowHours: number;
  minRequests: number;
  minDataPoints: number;
  severity?: SeverityLevel;
}


class Statistics {
  static mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  static stddev(values: number[]): number {
    if (values.length < 2) return 0;
    const avg = this.mean(values);
    const squareDiffs = values.map((value) => Math.pow(value - avg, 2));
    const avgSquareDiff = this.mean(squareDiffs);
    return Math.sqrt(avgSquareDiff);
  }

  static median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  static calculateMADScore(historicalValues: number[], currentValue: number, minPeriods: number): number | null {
    if (historicalValues.length < minPeriods) {
      return null;
    }

    const medianValue = this.median(historicalValues);
    const absoluteDeviations = historicalValues.map((val) => Math.abs(val - medianValue));
    const mad = this.median(absoluteDeviations);

    if (mad === 0) {
      return currentValue !== medianValue ? 10.0 : 0.0;
    }

    const scaleFactor = 1.4826;
    return Math.abs((currentValue - medianValue) / (scaleFactor * mad));
  }
}

export class RealtimeAnomalyDetector {
  constructor(private pool: Pool) {}

  async detectAnomalies(params: DetectionParams): Promise<AnomalyResult[]> {
    const { teamId, startTime, endTime, windowHours, minRequests, minDataPoints } = params;

    const baselineStart = new Date(startTime.getTime() - windowHours * 3600000);

    const routeMetrics = await this.queryMetricsFromRaw(
      teamId,
      baselineStart,
      endTime,
      minRequests
    );

    const anomalies: AnomalyResult[] = [];

    for (const route of routeMetrics) {
      const baselineData = route.timeBuckets.filter(
        (tb) => tb.time_bucket >= baselineStart && tb.time_bucket < startTime
      );
      const currentData = route.timeBuckets.filter(
        (tb) => tb.time_bucket >= startTime && tb.time_bucket < endTime
      );

      if (baselineData.length < minDataPoints) {
        continue;
      }

      if (currentData.length === 0) {
        continue;
      }

      // Analyze latency anomalies
      const latencyAnomalies = this.detectMetricAnomalies(route,
        baselineData,
        currentData,
        'avg_latency',
        minDataPoints
      );
      anomalies.push(...latencyAnomalies);

      const errorAnomalies = this.detectMetricAnomalies(route,
        baselineData,
        currentData,
        'error_rate',
        minDataPoints
      );
      anomalies.push(...errorAnomalies);
    }

    if (params.severity) {
      return anomalies.filter((a) => a.severity === params.severity);
    }

    return anomalies;
  }

  private detectMetricAnomalies(
    route: RouteMetrics,
    baselineData: TimeBucketData[],
    currentData: TimeBucketData[],
    metric: MetricType,
    minDataPoints: number
  ): AnomalyResult[] {
    const anomalies: AnomalyResult[] = [];

    const baselineValues = baselineData.map((tb) =>
      metric === 'avg_latency' ? tb.avg_latency : tb.error_rate
    );

    const baselineMean = Statistics.mean(baselineValues);
    const baselineStdDev = Statistics.stddev(baselineValues);

    for (const currentBucket of currentData) {
      const currentValue = metric === 'avg_latency' ? currentBucket.avg_latency : currentBucket.error_rate;

      let zScore: number;
      let calculatedStdDev: number | null = baselineStdDev;

      if (baselineStdDev > 0) {
        zScore = Math.abs((currentValue - baselineMean) / baselineStdDev);
      } else {
        const madScore = Statistics.calculateMADScore(baselineValues, currentValue, minDataPoints);
        if (madScore === null) {
          continue; // Insufficient data 
        }
        zScore = madScore;
        calculatedStdDev = null; 
      }

      const severity = this.classifySeverity(zScore);

      if (severity !== 'info') {
        anomalies.push({
          id: uuidv4(),
          team_id: route.team_id,
          service_name: route.service_name,
          route: route.route,
          time_bucket: currentBucket.time_bucket.toISOString(),
          metric,
          score: zScore,
          severity,
          baseline_mean: baselineMean,
          baseline_std: calculatedStdDev,
          created_at: new Date().toISOString(),
        });
      }
    }

    return anomalies;
  }

  private classifySeverity(zScore: number): SeverityLevel {
    const { criticalThreshold, warningThreshold } = config.anomaly;

    if (zScore >= criticalThreshold) {
      return 'critical';
    } else if (zScore >= warningThreshold) {
      return 'warning';
    } else {
      return 'info';
    }
  }
  private async queryMetricsFromRaw(
    teamId: string,
    startTime: Date,
    endTime: Date,
    minRequests: number
  ): Promise<RouteMetrics[]> {
    const query = `
      WITH time_buckets AS (
        SELECT
          service_name,
          route,
          date_trunc('hour', timestamp) as time_bucket,
          COUNT(*) as request_count,
          AVG(duration_ms) as avg_latency,
          STDDEV(duration_ms) as stddev_latency,
          CASE
            WHEN COUNT(*) > 0
            THEN (SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 100.0)
            ELSE 0.0
          END as error_rate
        FROM requests_raw
        WHERE team_id = $1
          AND timestamp >= $2
          AND timestamp < $3
          AND duration_ms > 0
        GROUP BY service_name, route, time_bucket
        HAVING COUNT(*) >= $4
      )
      SELECT
        $1::uuid as team_id,
        service_name,
        route,
        time_bucket,
        request_count,
        avg_latency,
        stddev_latency,
        error_rate
      FROM time_buckets
      ORDER BY service_name, route, time_bucket;
    `;

    const result = await this.pool.query(query, [teamId, startTime, endTime, minRequests]);

    const routeMap = new Map<string, RouteMetrics>();

    for (const row of result.rows) {
      const routeKey = `${row.service_name}::${row.route}`;

      if (!routeMap.has(routeKey)) {
        routeMap.set(routeKey, {
          team_id: row.team_id,
          service_name: row.service_name,
          route: row.route,
          timeBuckets: [],
        });
      }

      routeMap.get(routeKey)!.timeBuckets.push({time_bucket: row.time_bucket,
        request_count: parseInt(row.request_count, 10),
        avg_latency: parseFloat(row.avg_latency),
        stddev_latency: row.stddev_latency ? parseFloat(row.stddev_latency) : null,
        error_rate: parseFloat(row.error_rate),
      });
    }

    return Array.from(routeMap.values());
  }
}
