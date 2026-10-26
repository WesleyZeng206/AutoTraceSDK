import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { storageService } from '../services/storage';
import { RealtimeAnomalyDetector } from '../services/realtimeAnomalyDetector';
import { config } from '../config';
import { cacheService } from '../services/cache';
import { CacheKeys } from '../utils/cacheKeys';
import { normalizeWindow } from '../utils/timeWindow';

export const anomaliesRealtimeRouter = Router();

const detector = new RealtimeAnomalyDetector(storageService.pool);

anomaliesRealtimeRouter.get('/', requireAuth(storageService.pool), async (req: Request, res: Response) => {
  try {
    const {
      teamId,
      startTime: startTimeRaw,
      endTime: endTimeRaw,
      windowHours: windowHoursRaw,
      severity,
      limit: limitRaw,
      minRequests: minRequestsRaw,
    } = req.query;

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

    const windowHours = windowHoursRaw
      ? parseInt(windowHoursRaw as string, 10)
      : config.anomaly.defaultWindowHours;

    if (Number.isNaN(windowHours) || windowHours < 1 || windowHours > config.anomaly.maxWindowHours) {
      return res.status(400).json({
        error: 'Invalid query parameter',
        message: `windowHours must be a number between 1 and ${config.anomaly.maxWindowHours}`,
      });
    }

    const endTime = endTimeRaw ? new Date(endTimeRaw as string) : new Date();
    const startTime = startTimeRaw
      ? new Date(startTimeRaw as string)
      : new Date(endTime.getTime() - windowHours * 60 * 60 * 1000);

    if (Number.isNaN(startTime.getTime())) {
      return res.status(400).json({
        error: 'Invalid query parameter',
        message: 'startTime must be a valid ISO-8601 timestamp',
      });
    }

    if (Number.isNaN(endTime.getTime())) {
      return res.status(400).json({
        error: 'Invalid query parameter',
        message: 'endTime must be a valid ISO-8601 timestamp',
      });
    }

    if (startTime >= endTime) {
      return res.status(400).json({
        error: 'Invalid query parameter',
        message: 'startTime must be earlier than endTime',
      });
    }

    const limit = limitRaw ? parseInt(limitRaw as string, 10) : 100;
    if (Number.isNaN(limit) || limit < 1 || limit > 1000) {
      return res.status(400).json({
        error: 'Invalid query parameter',
        message: 'limit must be a number between 1 and 1000',
      });
    }

    const minRequests = minRequestsRaw
      ? parseInt(minRequestsRaw as string, 10)
      : config.anomaly.minRequests;

    if (Number.isNaN(minRequests) || minRequests < 1) {
      return res.status(400).json({
        error: 'Invalid query parameter',
        message: 'minRequests must be a positive number',
      });
    }

    if (severity && typeof severity === 'string') {
      const validSeverities = ['info', 'warning', 'critical'];
      if (!validSeverities.includes(severity)) {
        return res.status(400).json({
          error: 'Invalid query parameter',
          message: 'severity must be one of: info, warning, critical',
        });
      }
    }

    const { start: normalizedStart, end: normalizedEnd } = normalizeWindow(startTime, endTime);

    const cacheKey = CacheKeys.anomalies(
      teamId,
      normalizedStart.toISOString(),
      normalizedEnd.toISOString(),
      windowHours,
      severity as string | undefined
    );

    const cached = await cacheService.get<any[]>(cacheKey);
    if (cached) {
      const limitedCached = cached.slice(0, limit);
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json({
        anomalies: limitedCached,
        count: limitedCached.length,
        filters: {
          teamId,
          startTime: normalizedStart.toISOString(),
          endTime: normalizedEnd.toISOString(),
          windowHours,
          severity: severity || null,
          minRequests,
        },
      });
    }

    const anomalies = await detector.detectAnomalies({
      teamId,
      startTime,
      endTime,
      windowHours,
      minRequests,
      minDataPoints: config.anomaly.minDataPoints,
      severity: severity as 'info' | 'warning' | 'critical' | undefined,
    });

    const ttl = config.cache.ttlSeconds.anomalies;
    await cacheService.set(cacheKey, anomalies, ttl);

    const limitedAnomalies = anomalies.slice(0, limit);

    res.setHeader('X-Cache', 'MISS');
    res.status(200).json({
      anomalies: limitedAnomalies,
      count: limitedAnomalies.length,
      filters: {
        teamId,
        startTime: normalizedStart.toISOString(),
        endTime: normalizedEnd.toISOString(),
        windowHours,
        severity: severity || null,
        minRequests,
      },
    });
  } catch (error) {
    console.error('Error detecting real-time anomalies:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to detect anomalies',
    });
  }
});
