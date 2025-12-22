import { Router } from 'express';
import { aggregatorService, AggregatorBusyError } from '../services/aggregator';
import { verifyKey } from '../utils/apiKey';

export const aggregatorRouter = Router();

aggregatorRouter.use((req, res, next) => {
  if (!verifyKey(req.headers['x-api-key'])) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing API key' });
  }

  next();
});

aggregatorRouter.get('/status', (_req, res) => {
  res.json(aggregatorService.getStatus());
});

aggregatorRouter.post('/run', async (req, res) => {
  try {
    const range = parseRange(req.body);
    if (range) {
      await aggregatorService.runRange(range.start, range.end);
    } else {
      await aggregatorService.run();
    }

    res.json({ success: true });
  } catch (error) {
    if (error instanceof AggregatorBusyError) {
      return res.status(409).json({ error: 'Aggregator busy', message: 'An aggregation job is already running' });
    }

    if (error instanceof Error && error.message.toLowerCase().includes('invalid')) {
      return res.status(400).json({ error: 'Invalid request', message: error.message });
    }

    console.error('Aggregator run failed:', error);
    res.status(500).json({ error: 'Internal server error', message: 'Failed to trigger aggregator' });
  }
});

function parseRange(body: unknown): { start: Date; end: Date } | null {
  if (!body || typeof body !== 'object') return null;
  const payload = body as Record<string, unknown>;
  if (!payload.start && !payload.end) return null;
  if (!payload.start || !payload.end) throw new Error('Invalid range: both start and end required');

  const start = toDate(payload.start, 'start');
  const end = toDate(payload.end, 'end');
  if (!(start < end)) throw new Error('Invalid range: start must be before end');
  return { start, end };
}

function toDate(value: unknown, label: string): Date {
  if (typeof value !== 'string') throw new Error(`Invalid ${label}: expected ISO timestamp string`);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ${label}: must be ISO timestamp`);
  return d;
}
