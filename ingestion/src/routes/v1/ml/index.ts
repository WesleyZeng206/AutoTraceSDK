import { Router, Request, Response } from 'express';
import { ApiKeyService } from '../../../services/apiKeys';
import { MlLlmService, LlmEvent, MlValidationError } from '../../../services/mlLlmService';
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

function errorResponse(res: Response, status: number, error: string, message = error, code?: string) {
  return res.status(status).json({ error, message, ...(code ? { code } : {}) });
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

  const teamId =
    typeof req.query.team_id === 'string'
      ? req.query.team_id
      : typeof req.query.teamId === 'string'
        ? req.query.teamId
        : '';
  if (!teamId) return null;

  const hasAccess = req.teams?.some((team) => team.id === teamId);
  if (!hasAccess) return null;

  return teamId;
}

function parseWindow(req: Request): { from: Date; to: Date } | null {
  const fromRaw = (req.query.from ?? req.query.startTime) as string | undefined;
  const toRaw = (req.query.to ?? req.query.endTime) as string | undefined;
  const from = fromRaw ? new Date(fromRaw) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const to   = toRaw   ? new Date(toRaw)   : new Date();
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || from >= to) return null;
  return { from, to };
}

function normalizeEvent(body: Partial<LlmEvent>, idempotencyKey?: string): LlmEvent {
  return {
    provider: body.provider!,
    model: body.model!,
    operation: body.operation,
    started_at: body.started_at!,
    latency_ms: body.latency_ms ?? body.duration_ms,
    status: body.status,
    prompt_tokens: body.prompt_tokens,
    completion_tokens: body.completion_tokens,
    total_tokens: body.total_tokens,
    estimated_cost_usd: body.estimated_cost_usd ?? body.cost_usd,
    error_type: body.error_type,
    error_message: body.error_message,
    metadata: body.metadata,
    idempotency_key: idempotencyKey ?? body.idempotency_key,
  };
}

mlRouter.post('/llm/events', async (req: Request, res: Response) => {
  const idemKey = getIdempotencyKey(req);
  if (!idemKey) {
    return errorResponse(res, 400, 'Idempotency-Key header is required', 'Idempotency-Key header is required', 'ML_IDEMPOTENCY_KEY_REQUIRED');
  }

  const auth = await resolveApiKey(req);
  if (!auth) return errorResponse(res, 401, 'Invalid or missing API key');

  const body = req.body as Partial<LlmEvent>;

  if (!body.provider || !body.model || !body.started_at) {
    return errorResponse(res, 400, 'provider, model, and started_at are required');
  }

  const event = normalizeEvent(body, idemKey);

  try {
    const r = await llmService.insertBatch([event], auth.teamId);
    if (r.skipped > 0) return res.status(202).json({ accepted: 0, duplicate: 1 });
    return res.status(201).json({ id: r.events[0]?.id, idempotency_key: idemKey });
  } catch (err) {
    if (err instanceof MlValidationError) {
      return errorResponse(res, err.status, err.message, err.message, err.code);
    }
    console.error('POST /llm/events error:', err);
    return errorResponse(res, 500, 'Internal server error');
  }
});

mlRouter.post('/llm/events/batch', async (req: Request, res: Response) => {
  const idemKey = getIdempotencyKey(req);
  if (!idemKey) {
    return errorResponse(res, 400, 'Idempotency-Key header is required', 'Idempotency-Key header is required', 'ML_IDEMPOTENCY_KEY_REQUIRED');
  }

  const auth = await resolveApiKey(req);
  if (!auth) return errorResponse(res, 401, 'Invalid or missing API key');

  const { events } = req.body as { events?: LlmEvent[] };
  if (!Array.isArray(events) || events.length === 0) {
    return errorResponse(res, 400, 'events must be a non-empty array');
  }

  if (events.length > 500) {
    return errorResponse(res, 400, 'Batch size cannot exceed 500');
  }

  const normalized: LlmEvent[] = events.map((event, index) =>
    normalizeEvent(event, event.idempotency_key?.trim() || `${idemKey}:${index}`)
  );

  const invalid = normalized.findIndex(e => !e.provider || !e.model || !e.started_at);

  if (invalid !== -1) {
    return errorResponse(res, 400, `Event at index ${invalid} missing required fields`);
  }

  try {
    const r = await llmService.insertBatch(normalized, auth.teamId);

    return res.status(202).json({ accepted: r.inserted, duplicate: r.skipped });
  } catch (err) {
    if (err instanceof MlValidationError) {
      return errorResponse(res, err.status, err.message, err.message, err.code);
    }
    console.error('POST /llm/events/batch error:', err);
    return errorResponse(res, 500, 'Internal server error');
  }
});

mlRouter.get('/llm/pricing', async (req: Request, res: Response) => {
  if (!req.user) {
    const auth = await resolveApiKey(req);
    if (!auth) return errorResponse(res, 401, 'Invalid or missing API key');
  }

  try {
    const pricing = await llmService.getPricing({
      provider: req.query.provider as string | undefined,
      model:    req.query.model    as string | undefined,
    });
    return res.json({ pricing });
  } catch (err) {
    console.error('GET /llm/pricing error:', err);
    return errorResponse(res, 500, 'Internal server error');
  }
});

mlRouter.get('/llm/summary', async (req: Request, res: Response) => {
  if (!req.user) {
    return errorResponse(res, 403, 'Session authentication is required for ML read endpoints');
  }

  const teamId = getAuthorizedTeamId(req);
  if (!teamId) return errorResponse(res, 403, 'Forbidden: You do not have access to this team');

  const window = parseWindow(req);
  if (!window) return errorResponse(res, 400, 'Invalid or missing time window');

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
    return errorResponse(res, 500, 'Internal server error');
  }
});

mlRouter.get('/llm/events', async (req: Request, res: Response) => {
  if (!req.user) {
    return errorResponse(res, 403, 'Session authentication is required for ML read endpoints');
  }

  const teamId = getAuthorizedTeamId(req);
  if (!teamId) return errorResponse(res, 403, 'Forbidden: You do not have access to this team');

  const window = parseWindow(req);
  if (!window) return errorResponse(res, 400, 'Invalid or missing time window');

  const limit = parseLimit(req.query.limit as string | undefined);
  if (limit === null) return errorResponse(res, 400, 'Invalid limit: must be a positive integer');

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
    
    return errorResponse(res, 500, 'Internal server error');
  }
});
