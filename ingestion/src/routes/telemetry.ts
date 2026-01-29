import { Router, Request, Response } from 'express';
import type { TelemetryEvent } from '@autotrace/telemetry';
import { validateEvent } from '../services/validator';
import { ApiKeyService } from '../services/apiKeys';
import { storageService } from '../services/storage';
import { requireAuth } from '../middleware/auth';
import { telemetryRateLimiter, getClientIP, trackAPIKeyAttempt } from '../middleware/security';
import { telemetryProcessor } from '../services/telemetryProcessor';

export const telemetryRouter = Router();

const apiKeyService = new ApiKeyService(storageService.pool);

telemetryRouter.post('/', telemetryRateLimiter, async (req: Request, res: Response) => {
  try {
    const clientIP = getClientIP(req);
    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'Invalid request', message: 'Body must include an "events" array with at least one entry' });
    }

    if (events.length > 500) {
      return res.status(400).json({ error: 'Batch too large', message: 'Send at most 500 events at a time' });
    }

    const apiKeyHeader = req.headers['x-api-key'];
    const apiKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;

    if (!apiKey) {
      trackAPIKeyAttempt(clientIP, false);
      return res.status(401).json({ error: 'Unauthorized', message: 'Missing API key in x-api-key header' });
    }

    const keyValidation = await apiKeyService.validateKey(apiKey);

    if (!keyValidation.valid || !keyValidation.teamId) {
      trackAPIKeyAttempt(clientIP, false);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired API key'
      });
    }

    // Track successful API key validation
    trackAPIKeyAttempt(clientIP, true);

    const rejected: Array<{ index: number; errors: string[] }> = [];
    const accepted: TelemetryEvent[] = [];

    events.forEach((event, index) => {
      const validationErrors = validateEvent(event);
      if (validationErrors.length > 0) {
        rejected.push({ index, errors: validationErrors });
      } else {
        accepted.push(event as TelemetryEvent);
      }
    });

    if (rejected.length > 0) {
      return res.status(400).json({ error: 'Validation failed', message: `${rejected.length} events failed validation`, validationErrors: rejected });
    }

    telemetryProcessor.enqueue(accepted, keyValidation.teamId, keyValidation.keyId);

    res.status(202).json({
      message: 'Events accepted',
      count: accepted.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error processing telemetry:', error);
    res.status(500).json({ error: 'Internal server error', message: 'Failed to process telemetry events' });
  }
});

telemetryRouter.get('/', requireAuth(storageService.pool), async (req: Request, res: Response) => {
  try {
    const parsed = parseFilters(req.query);
    if ('error' in parsed) {
      return res.status(400).json(parsed.error);
    }

    if (!parsed.teamId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'teamId query parameter is required',
      });
    }

    const hasAccess = req.teams?.some((team) => team.id === parsed.teamId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this team',
      });
    }

    const [events, total] = await Promise.all([storageService.queryEvents(parsed), storageService.countEvents(parsed)]);

    res.status(200).json({ events, total, count: events.length, filters: parsed });
  } catch (error) {
    console.error('Error querying telemetry:', error);
    res.status(500).json({ error: 'Internal server error', message: 'Failed to query telemetry events' });
  }
});

type ParsedFilters = {
  service?: string;
  route?: string;
  startTime?: Date;
  endTime?: Date;
  limit: number;
  offset: number;
  teamId?: string;
};

function parseFilters(query: Request['query']): ParsedFilters | { error: { error: string; message: string } } {
  const { service, route, startTime, endTime, limit = '100', offset = '0', teamId } = query;

  const parsedLimit = parseInt(limit as string, 10);
  const parsedOffset = parseInt(offset as string, 10);
  const parsedStart = startTime ? new Date(startTime as string) : undefined;
  const parsedEnd = endTime ? new Date(endTime as string) : undefined;

  if (parsedStart && Number.isNaN(parsedStart.getTime())) {
    return { error: { error: 'Invalid query parameter', message: 'startTime must be a valid ISO-8601 timestamp' } };
  }

  if (parsedEnd && Number.isNaN(parsedEnd.getTime())) {
    return { error: { error: 'Invalid query parameter', message: 'endTime must be a valid ISO-8601 timestamp' } };
  }

  if (parsedStart && parsedEnd && parsedStart > parsedEnd) {
    return { error: { error: 'Invalid query parameter', message: 'startTime must be earlier than endTime' } };
  }

  if (!Number.isFinite(parsedLimit) || parsedLimit <= 0 || parsedLimit > 1000) {
    return { error: { error: 'Invalid query parameter', message: 'limit must be between 1 and 1000' } };
  }

  if (!Number.isFinite(parsedOffset) || parsedOffset < 0) {
    return { error: { error: 'Invalid query parameter', message: 'offset must be a non-negative number' } };
  }

  return {
    service: service as string,
    route: route as string,
    startTime: parsedStart,
    endTime: parsedEnd,
    limit: parsedLimit,
    offset: parsedOffset,
    teamId: teamId as string | undefined,
  };
}
