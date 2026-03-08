import { Router, Request, Response } from 'express';
import { ApiKeyService } from '../../../services/apiKeys';
import { MlLlmService, LlmEvent } from '../../../services/mlLlmService';
import { storageService } from '../../../services/storage';
import { requireAuth } from '../../../middleware/auth';

export const mlRouter = Router();

const apiKeyService = new ApiKeyService(storageService.pool);
const llmService = new MlLlmService(storageService.pool);
const sessionAuth = requireAuth(storageService.pool);

mlRouter.use((req, res, next) => {
  const raw = req.headers['x-api-key'];
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return next();
  }

  return sessionAuth(req, res, next);
});

async function resolveApiKey(req: Request): Promise<{ teamId: string; keyId: string } | null> {
  const raw = req.headers['x-api-key'];
  if (typeof raw !== 'string' || !raw.trim()) {
    return null;
  }
  
  const result = await apiKeyService.validateKey(raw.trim());

  if (!result.valid || !result.teamId || !result.keyId) return null;
  return { teamId: result.teamId, keyId: result.keyId };
}

function parseLimit(raw: string | undefined): number | null {
  if (!raw) return 50;
  const parsed = parseInt(raw, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.min(parsed, 200);
}

function getIdempotencyKey(req: Request): string | null {
  const header = req.headers['idempotency-key'];

  if (typeof header !== 'string') {
    return null;
  }
  
  const trimmed = header.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function getAuthorizedTeamId(req: Request): string | null {
  if (!req.user) return null;

  const teamId = typeof req.query.team_id === 'string' ? req.query.team_id : '';
  if (!teamId) return null;

  const hasAccess = req.teams?.some((team) => team.id === teamId);
  if (!hasAccess) return null;

  return teamId;
}

function parseWindow(req: Request): { from: Date; to: Date } | null {
  const from = req.query.from ? new Date(req.query.from as string) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const to   = req.query.to   ? new Date(req.query.to   as string) : new Date();
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || from >= to) return null;
  return { from, to };
}

mlRouter.post('/llm/events', async (req: Request, res: Response) => {
  const idemKey = getIdempotencyKey(req);
  if (!idemKey) {
    return res.status(400).json({ error: 'Idempotency-Key header is required' });
  }

  const auth = await resolveApiKey(req);
  if (!auth) return res.status(401).json({ error: 'Invalid or missing API key' });

  const body = req.body as Partial<LlmEvent>;

  if (!body.provider || !body.model || !body.started_at) {
    return res.status(400).json({ error: 'provider, model, and started_at are required' });
  }

  const event: LlmEvent = {provider: body.provider!,
    model: body.model!,
    started_at: body.started_at!,
    duration_ms: body.duration_ms,
    status: body.status,
    prompt_tokens: body.prompt_tokens,
    completion_tokens: body.completion_tokens,
    total_tokens: body.total_tokens,
    cost_usd: body.cost_usd,
    metadata: body.metadata,
    idempotency_key: idemKey,
  };

  try {
    const r = await llmService.insertBatch([event], auth.teamId);
    if (r.skipped > 0) return res.status(202).json({ accepted: 0, duplicate: 1 });
    return res.status(201).json({ accepted: 1, duplicate: 0 });
  } catch (err) {
    console.error('POST /llm/events error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

mlRouter.post('/llm/events/batch', async (req: Request, res: Response) => {
  const idemKey = getIdempotencyKey(req);
  if (!idemKey) {
    return res.status(400).json({ error: 'Idempotency-Key header is required' });
  }

  const auth = await resolveApiKey(req);
  if (!auth) return res.status(401).json({ error: 'Invalid or missing API key' });

  const { events } = req.body as { events?: LlmEvent[] };
  if (!Array.isArray(events) || events.length === 0) {
    return res.status(400).json({ error: 'events must be a non-empty array' });
  }

  if (events.length > 500) {
    return res.status(400).json({ error: 'Batch size cannot exceed 500' });
  }

  const normalized: LlmEvent[] = events.map((event, index) => ({...event,
    idempotency_key: event.idempotency_key?.trim() || `${idemKey}:${index}`,
  }));

  const invalid = normalized.findIndex(e => !e.provider || !e.model || !e.started_at);

  if (invalid !== -1) {
    return res.status(400).json({ error: `Event at index ${invalid} missing required fields` });
  }

  try {
    const r = await llmService.insertBatch(normalized, auth.teamId);

    return res.status(202).json({ accepted: r.inserted, duplicate: r.skipped });
  } catch (err) {
    console.error('POST /llm/events/batch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

mlRouter.get('/llm/summary', async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(403).json({ error: 'Session authentication is required for ML read endpoints' });
  }

  const teamId = getAuthorizedTeamId(req);
  if (!teamId) return res.status(403).json({ error: 'Forbidden: You do not have access to this team' });

  const window = parseWindow(req);
  if (!window) return res.status(400).json({ error: 'Invalid or missing time window' });

  try {
    const data = await llmService.getSummary({
      teamId,
      ...window,
      provider: req.query.provider as string | undefined,
      model:    req.query.model    as string | undefined,
    });

    return res.json(data);
  } catch (err) {
    console.error('GET /llm/summary error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

mlRouter.get('/llm/events', async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(403).json({ error: 'Session authentication is required for ML read endpoints' });
  }

  const teamId = getAuthorizedTeamId(req);
  if (!teamId) return res.status(403).json({ error: 'Forbidden: You do not have access to this team' });

  const window = parseWindow(req);
  if (!window) return res.status(400).json({ error: 'Invalid or missing time window' });

  const limit = parseLimit(req.query.limit as string | undefined);
  if (limit === null) return res.status(400).json({ error: 'Invalid limit: must be a positive integer' });

  try {
    const data = await llmService.listEvents({teamId,...window,
      provider: req.query.provider as string | undefined,
      model:    req.query.model    as string | undefined,
      status:   req.query.status   as string | undefined,
      cursor:   req.query.cursor   as string | undefined,
      limit,});

    return res.json(data);
  } catch (err) {
    console.error('GET /llm/events error:', err);
    
    return res.status(500).json({ error: 'Internal server error' });
  }
});
