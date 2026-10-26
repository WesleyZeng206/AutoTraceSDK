import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { storageService } from '../services/storage';
import { cacheService } from '../services/cache';
import { config } from '../config';
import { CacheKeys } from '../utils/cacheKeys';
import { normalizeWindow } from '../utils/timeWindow';

export const distributionRouter = Router();

interface DistributionRow {
  range_start: number;
  range_end: number;
  count: string;
}

distributionRouter.get('/', requireAuth(storageService.pool), async (req: Request, res: Response) => {
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

    const { start: normalizedStart, end: normalizedEnd } = normalizeWindow(historicalStartTime,
      effectiveEnd
    );

    const cacheKey = CacheKeys.distribution(
      teamId,
      normalizedStart.toISOString(),
      normalizedEnd.toISOString(),
      service as string | undefined,
      route as string | undefined
    );

    const cached = await cacheService.get<{ range: string; count: number }[]>(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json({ distribution: cached });
    }

    const ranges = [
      { start: 0, end: 50, label: '0-50ms' },
      { start: 50, end: 100, label: '50-100ms' },
      { start: 100, end: 200, label: '100-200ms' },
      { start: 200, end: 500, label: '200-500ms' },
      { start: 500, end: 1000, label: '500ms-1s' },
      { start: 1000, end: 999999, label: '1s+' },
    ];

    const params: any[] = [teamId, historicalStartTime.toISOString(), effectiveEnd.toISOString()];
    let paramIndex = 4;

    let sql = `
      SELECT
        SUM(CASE WHEN duration_ms >= 0 AND duration_ms < 50 THEN 1 ELSE 0 END) as range_0_50,
        SUM(CASE WHEN duration_ms >= 50 AND duration_ms < 100 THEN 1 ELSE 0 END) as range_50_100,
        SUM(CASE WHEN duration_ms >= 100 AND duration_ms < 200 THEN 1 ELSE 0 END) as range_100_200,
        SUM(CASE WHEN duration_ms >= 200 AND duration_ms < 500 THEN 1 ELSE 0 END) as range_200_500,
        SUM(CASE WHEN duration_ms >= 500 AND duration_ms < 1000 THEN 1 ELSE 0 END) as range_500_1000,
        SUM(CASE WHEN duration_ms >= 1000 THEN 1 ELSE 0 END) as range_1000_plus
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

    const result = await storageService.pool.query(sql, params);

    if (result.rows.length === 0) {
      const distribution = ranges.map(range => ({ range: range.label, count: 0 }));
      return res.status(200).json({ distribution });
    }

    const row = result.rows[0];
    const distribution = [
      { range: '0-50ms', count: parseInt(row.range_0_50 || '0', 10) },
      { range: '50-100ms', count: parseInt(row.range_50_100 || '0', 10) },
      { range: '100-200ms', count: parseInt(row.range_100_200 || '0', 10) },
      { range: '200-500ms', count: parseInt(row.range_200_500 || '0', 10) },
      { range: '500ms-1s', count: parseInt(row.range_500_1000 || '0', 10) },
      { range: '1s+', count: parseInt(row.range_1000_plus || '0', 10) },
    ];

    const ttl = config.cache.ttlSeconds.distribution;
    await cacheService.set(cacheKey, distribution, ttl);

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json({ distribution });
  } catch (error) {
    console.error('Error fetching response time distribution:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch response time distribution',
    });
  }
});
