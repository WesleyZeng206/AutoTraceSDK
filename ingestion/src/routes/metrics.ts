import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { storageService } from '../services/storage';
import { cacheService } from '../services/cache';
import { CacheKeys } from '../utils/cacheKeys';
import { normalizeWindow } from '../utils/timeWindow';

export const metricsRouter = Router();

interface MetricsRow {
  time_bucket: string;
  request_count: string;
  error_count: string;
  avg_latency: string;
  p50_latency: string;
  p90_latency: string;
  p95_latency: string;
  p99_latency: string;
}

const INTERVAL_MAP: Record<string, number> = {
  '15m': 15,
  '30m': 30,
  '1h': 60,
  '60m': 60,
};

metricsRouter.get('/', requireAuth(storageService.pool), async (req: Request, res: Response) => {
  try {
    const { teamId, service, route, startTime: startTimeRaw, endTime: endTimeRaw } = req.query;
    const intervalParam = typeof req.query.interval === 'string' ? req.query.interval : undefined;
    const bucketMinutes = intervalParam ? INTERVAL_MAP[intervalParam] : undefined;

    if (!teamId || typeof teamId !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'teamId query parameter is required',
      });
    }

    const hasAccess = req.teams?.some((team) => team.id === teamId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this team',
      });
    }

    const startTime = startTimeRaw ? new Date(startTimeRaw as string) : undefined;
    const endTime = endTimeRaw ? new Date(endTimeRaw as string) : undefined;

    if (startTime && Number.isNaN(startTime.getTime())) {
      return res.status(400).json({
        error: 'Invalid query parameter',
        message: 'startTime must be a valid ISO-8601 timestamp',
      });
    }

    if (endTime && Number.isNaN(endTime.getTime())) {
      return res.status(400).json({
        error: 'Invalid query parameter',
        message: 'endTime must be a valid ISO-8601 timestamp',
      });
    }

    if (startTime && endTime && startTime > endTime) {
      return res.status(400).json({
        error: 'Invalid query parameter',
        message: 'startTime must be earlier than endTime',
      });
    }

    const now = new Date();
    const requestedEnd = endTime ?? now;
    const effectiveEnd = requestedEnd > now ? now : requestedEnd;
    const fallbackStart = startTime ?? new Date(effectiveEnd.getTime() - 24 * 60 * 60 * 1000);
    const historicalStartTime = startTime || fallbackStart;

    const { start: normalizedStart, end: normalizedEnd } = normalizeWindow(
      historicalStartTime,
      effectiveEnd
    );

    const cacheKey = CacheKeys.metrics(teamId,
      normalizedStart.toISOString(),
      normalizedEnd.toISOString(),
      intervalParam || '1h',
      service as string | undefined,
      route as string | undefined
    );

    const cached = await cacheService.get<MetricsRow[]>(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json({ metrics: cached });
    }

    const windowDurationHours =
      (effectiveEnd.getTime() - historicalStartTime.getTime()) / (1000 * 60 * 60);
    const intervalMinutes = bucketMinutes || 60;
    const useHourlyAggregates = (intervalMinutes >= 60 && windowDurationHours > 168) && !route;
    const params: any[] = [teamId, historicalStartTime.toISOString(), effectiveEnd.toISOString()];
    let paramIndex = 4;

    if (useHourlyAggregates) {
      let sql = `
        WITH time_series AS (
          SELECT generate_series(
            date_trunc('hour', $2::timestamptz),
            date_trunc('hour', $3::timestamptz),
            INTERVAL '1 hour'
          ) AS time_bucket
        ),
        hourly AS (
          SELECT
            time_bucket,
            SUM(request_count) as request_count,
            SUM(error_count) as error_count,
            SUM(avg_latency * request_count)::float / NULLIF(SUM(request_count), 0) as avg_latency,
            SUM(p50_latency * request_count)::float / NULLIF(SUM(request_count), 0) as p50_latency,
            SUM(p90_latency * request_count)::float / NULLIF(SUM(request_count), 0) as p90_latency,
            SUM(p95_latency * request_count)::float / NULLIF(SUM(request_count), 0) as p95_latency,
            SUM(p99_latency * request_count)::float / NULLIF(SUM(request_count), 0) as p99_latency
          FROM aggregated_metrics_hourly
          WHERE team_id = $1
            AND time_bucket >= date_trunc('hour', $2::timestamptz)
            AND time_bucket <= date_trunc('hour', $3::timestamptz)
      `;

      if (service && typeof service === 'string') {
        sql += ` AND service_name = $${paramIndex++}`;
        params.push(service);
      }

      if (route && typeof route === 'string') {
        sql += ` AND route = $${paramIndex++}`;
        params.push(route);
      }

      sql += `
          GROUP BY time_bucket
        )
        SELECT
          ts.time_bucket,
          COALESCE(hourly.request_count, 0) as request_count,
          COALESCE(hourly.error_count, 0) as error_count,
          COALESCE(hourly.avg_latency, 0) as avg_latency,
          COALESCE(hourly.p50_latency, 0) as p50_latency,
          COALESCE(hourly.p90_latency, 0) as p90_latency,
          COALESCE(hourly.p95_latency, 0) as p95_latency,
          COALESCE(hourly.p99_latency, 0) as p99_latency
        FROM time_series ts
        LEFT JOIN hourly ON ts.time_bucket = hourly.time_bucket
        ORDER BY ts.time_bucket ASC
      `;

      const result = await storageService.pool.query<MetricsRow>(sql, params);

      const ttl = parseInt(process.env.REDIS_TTL_METRICS || '60', 10);
      await cacheService.set(cacheKey, result.rows, ttl);

      res.setHeader('X-Cache', 'MISS');
      return res.status(200).json({ metrics: result.rows });
    }

    const m = [15, 30, 60].includes(intervalMinutes) ? intervalMinutes : 60;

    let b: string;
    let s: string;
    let e: string;

    if (m >= 60) {
      b = `date_trunc('hour', timestamp)`;
      s = `date_trunc('hour', $2::timestamptz)`;
      e = `date_trunc('hour', $3::timestamptz)`;
    } else {
      b = `date_trunc('hour', timestamp) + (FLOOR(EXTRACT(MINUTE FROM timestamp) / ${m})::int * INTERVAL '${m} minutes')`;
      s = `date_trunc('hour', $2::timestamptz) + (FLOOR(EXTRACT(MINUTE FROM $2::timestamptz) / ${m})::int * INTERVAL '${m} minutes')`;
      e = `date_trunc('hour', $3::timestamptz) + (FLOOR(EXTRACT(MINUTE FROM $3::timestamptz) / ${m})::int * INTERVAL '${m} minutes')`;
    }

    let sql = `
      WITH time_series AS (
        SELECT generate_series(
          ${s},
          ${e},
          INTERVAL '${m} minutes'
        ) AS time_bucket
      ),
      aggregated AS (
        SELECT
          ${b} as time_bucket,
          COUNT(*) as request_count,
          SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_count,
          AVG(CASE WHEN duration_ms > 0 THEN duration_ms END) as avg_latency,
          PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE duration_ms > 0) as p50_latency,
          PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE duration_ms > 0) as p90_latency,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE duration_ms > 0) as p95_latency,
          PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE duration_ms > 0) as p99_latency
        FROM requests_raw
        WHERE team_id = $1
          AND timestamp >= $2
          AND timestamp < $3
    `;

    if (service && typeof service === 'string') {
      sql += ` AND service_name = $${paramIndex++}`;
      params.push(service);
    }

    if (route && typeof route === 'string') {
      sql += ` AND route = $${paramIndex++}`;
      params.push(route);
    }

    sql += `
        GROUP BY ${b}
      )
      SELECT
        ts.time_bucket,
        COALESCE(agg.request_count, 0) as request_count,
        COALESCE(agg.error_count, 0) as error_count,
        COALESCE(agg.avg_latency, 0) as avg_latency,
        COALESCE(agg.p50_latency, 0) as p50_latency,
        COALESCE(agg.p90_latency, 0) as p90_latency,
        COALESCE(agg.p95_latency, 0) as p95_latency,
        COALESCE(agg.p99_latency, 0) as p99_latency
      FROM time_series ts
      LEFT JOIN aggregated agg ON ts.time_bucket = agg.time_bucket
      ORDER BY ts.time_bucket ASC
    `;

    const result = await storageService.pool.query<MetricsRow>(sql, params);

    const ttl = parseInt(process.env.REDIS_TTL_METRICS || '60', 10);
    await cacheService.set(cacheKey, result.rows, ttl);

    res.setHeader('X-Cache', 'MISS');
    res.status(200).json({ metrics: result.rows });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch metrics',
    });
  }
});
