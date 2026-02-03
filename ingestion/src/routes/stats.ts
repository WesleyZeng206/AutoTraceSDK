import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { storageService } from '../services/storage';
import { cacheService } from '../services/cache';
import { CacheKeys } from '../utils/cacheKeys';
import { normalizeWindow } from '../utils/timeWindow';

export const statsRouter = Router();

interface StatsRow {
  total_requests: string;
  error_count: string;
  avg_latency: string;
  p50_latency: string;
  p90_latency: string;
  p95_latency: string;
  p99_latency: string;
}

statsRouter.get('/', requireAuth(storageService.pool), async (req: Request, res: Response) => {
  try {
    const { teamId, service, route, startTime: startTimeRaw, endTime: endTimeRaw } = req.query;

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

    const cacheKey = CacheKeys.stats(teamId,
      normalizedStart.toISOString(),
      normalizedEnd.toISOString(),
      service as string | undefined
    );

    const cached = await cacheService.get<any>(cacheKey);

    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json({ stats: cached });
    }

    const durationHours =
      (effectiveEnd.getTime() - historicalStartTime.getTime()) / (1000 * 60 * 60);
    const preferHourlyAggregates = durationHours > 168 && !route;

    const params: any[] = [teamId, historicalStartTime.toISOString(), effectiveEnd.toISOString()];
    let paramIndex = 4;
    let result;

    if (preferHourlyAggregates) {
      let sql = `
        SELECT
          SUM(request_count) as total_requests,
          SUM(error_count) as error_count,
          SUM(avg_latency * request_count)::float / NULLIF(SUM(request_count), 0) as avg_latency,
          SUM(p50_latency * request_count)::float / NULLIF(SUM(request_count), 0) as p50_latency,
          SUM(p90_latency * request_count)::float / NULLIF(SUM(request_count), 0) as p90_latency,
          SUM(p95_latency * request_count)::float / NULLIF(SUM(request_count), 0) as p95_latency,
          SUM(p99_latency * request_count)::float / NULLIF(SUM(request_count), 0) as p99_latency
        FROM aggregated_metrics_hourly
        WHERE team_id = $1
          AND time_bucket >= date_trunc('hour', $2::timestamptz)
          AND time_bucket < date_trunc('hour', $3::timestamptz) + INTERVAL '1 hour'
      `;

      if (service && typeof service === 'string') {
        sql += ` AND service_name = $${paramIndex++}`;
        params.push(service);
      }

      result = await storageService.pool.query<StatsRow>(sql, params);
    } else {
      let sql = `
        SELECT
          COUNT(*) as total_requests,
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

      result = await storageService.pool.query<StatsRow>(sql, params);
    }

    if (result.rows.length === 0) {
      return res.status(200).json({
        stats: {
          totalRequests: 0,
          errorCount: 0,
          errorRate: 0,
          avgLatency: 0,
          p50Latency: 0,
          p90Latency: 0,
          p95Latency: 0,
          p99Latency: 0,
        },
      });
    }

    const row = result.rows[0];
    const totalRequests = parseInt(row.total_requests, 10);
    const errorCount = parseInt(row.error_count, 10);
    const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;

    const stats = {
      totalRequests,
      errorCount,
      errorRate: Math.round(errorRate * 100) / 100,
      avgLatency: Math.round(parseFloat(row.avg_latency || '0') * 100) / 100,
      p50Latency: Math.round(parseFloat(row.p50_latency || '0') * 100) / 100,
      p90Latency: Math.round(parseFloat(row.p90_latency || '0') * 100) / 100,
      p95Latency: Math.round(parseFloat(row.p95_latency || '0') * 100) / 100,
      p99Latency: Math.round(parseFloat(row.p99_latency || '0') * 100) / 100,
    };

    const ttl = parseInt(process.env.REDIS_TTL_STATS || '60', 10);
    await cacheService.set(cacheKey, stats, ttl);

    res.setHeader('X-Cache', 'MISS');
    res.status(200).json({ stats });
    
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch stats',
    });
  }
});
