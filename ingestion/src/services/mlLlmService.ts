import { Pool } from 'pg';

export type LlmStatus = 'success' | 'error' | 'timeout' | 'cancelled';

export interface LlmEvent {
  idempotency_key?: string;
  provider: string;
  model: string;
  operation?: string;
  started_at: string;
  latency_ms?: number;
  status?: LlmStatus;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  estimated_cost_usd?: number;
  error_type?: string;
  error_message?: string;
  metadata?: Record<string, unknown>;

  // Backward-compatible aliases accepted at the API boundary.
  duration_ms?: number;
  cost_usd?: number;
}

export interface SummaryParams {
  teamId: string;
  from: Date;
  to: Date;
  provider?: string;
  model?: string;
}

export interface ListParams {
  teamId: string;
  from: Date;
  to: Date;
  provider?: string;
  model?: string;
  status?: string;
  cursor?: string;
  limit?: number;
}

export interface InsertedLlmEvent {
  id: string;
  idempotency_key: string | null;
}

type KeyedEvent = LlmEvent & { idempotency_key: string };

const MAX_METADATA_BYTES = 4096;
const MAX_PROVIDER_MODEL_PAIRS = 100;
const STATUSES = new Set<LlmStatus>(['success', 'error', 'timeout', 'cancelled']);

export class MlValidationError extends Error {
  constructor(message: string, public code = 'ML_VALIDATION_ERROR', public status = 400) {
    super(message);
  }
}

export class MlLlmService {
  constructor(private pool: Pool) {}

  async insertBatch(events: LlmEvent[], teamId: string): Promise<{ inserted: number; skipped: number; events: InsertedLlmEvent[] }> {
    if (events.length === 0) return { inserted: 0, skipped: 0, events: [] };

    const normalized = events.map((event, index) => this.normalizeEvent(event, index));
    const keyed: KeyedEvent[] = [];
    const unkeyed: LlmEvent[] = [];
    const payloadSeen = new Set<string>();
    let payloadDuplicates = 0;

    for (const event of normalized) {
      const rawKey = typeof event.idempotency_key === 'string' ? event.idempotency_key.trim() : '';
      if (!rawKey) {
        unkeyed.push(event);
        continue;
      }

      if (payloadSeen.has(rawKey)) {
        payloadDuplicates += 1;
        continue;
      }

      payloadSeen.add(rawKey);
      keyed.push({ ...event, idempotency_key: rawKey });
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      let newlyAccepted = new Set<string>();

      if (keyed.length > 0) {
        const keys = keyed.map(e => e.idempotency_key);
        const accepted = await client.query<{ key: string }>(
          `INSERT INTO ml_idempotency_keys (key, scope, team_id)
           SELECT UNNEST($1::text[]), 'llm', $2::uuid
           ON CONFLICT DO NOTHING
           RETURNING key`,
          [keys, teamId]
        );
        newlyAccepted = new Set(accepted.rows.map(r => r.key));
      }

      const acceptedKeyed = keyed.filter(e => newlyAccepted.has(e.idempotency_key));
      const toInsert = [...acceptedKeyed, ...unkeyed];

      if (toInsert.length > 0) {
        await this.enforceCardinalityLimit(client, teamId, toInsert);
      }

      let insertedRows: InsertedLlmEvent[] = [];

      if (toInsert.length > 0) {
        const inserted = await client.query<InsertedLlmEvent>(
          `WITH input AS (
             SELECT *
             FROM UNNEST(
               $2::text[],
               $3::text[],
               $4::text[],
               $5::text[],
               $6::timestamptz[],
               $7::int[],
               $8::text[],
               $9::int[],
               $10::int[],
               $11::int[],
               $12::numeric[],
               $13::text[],
               $14::text[],
               $15::jsonb[]
             ) AS e(
               idempotency_key, provider, model, operation, started_at, latency_ms,
               status, prompt_tokens, completion_tokens, total_tokens,
               estimated_cost_usd, error_type, error_message, metadata
             )
           )
           INSERT INTO ml_llm_events
             (team_id, idempotency_key, provider, model, operation, started_at,
              latency_ms, status, prompt_tokens, completion_tokens, total_tokens,
              estimated_cost_usd, error_type, error_message, metadata)
           SELECT
             $1::uuid,
             idempotency_key,
             provider,
             model,
             COALESCE(NULLIF(operation, ''), 'chat'),
             started_at,
             latency_ms,
             status,
             prompt_tokens,
             completion_tokens,
             CASE
               WHEN total_tokens IS NOT NULL THEN total_tokens
               WHEN prompt_tokens IS NOT NULL OR completion_tokens IS NOT NULL
                 THEN COALESCE(prompt_tokens, 0) + COALESCE(completion_tokens, 0)
               ELSE NULL
             END,
             COALESCE(
               estimated_cost_usd,
               CASE
                 WHEN pricing.provider IS NULL THEN NULL
                 ELSE (
                   (COALESCE(prompt_tokens, 0)::numeric / 1000000) * pricing.input_per_million_usd
                   + (COALESCE(completion_tokens, 0)::numeric / 1000000) * pricing.output_per_million_usd
                 )
               END
             ),
             error_type,
             LEFT(error_message, 500),
             metadata
           FROM input
           LEFT JOIN LATERAL (
             SELECT provider, input_per_million_usd, output_per_million_usd
             FROM ml_llm_pricing
             WHERE provider = input.provider
               AND model = input.model
               AND effective_date <= input.started_at::date
             ORDER BY effective_date DESC
             LIMIT 1
           ) pricing ON TRUE
           RETURNING id::text, idempotency_key`,
          [
            teamId,
            toInsert.map(e => e.idempotency_key ?? null),
            toInsert.map(e => e.provider),
            toInsert.map(e => e.model),
            toInsert.map(e => e.operation ?? 'chat'),
            toInsert.map(e => e.started_at),
            toInsert.map(e => e.latency_ms ?? null),
            toInsert.map(e => e.status ?? 'success'),
            toInsert.map(e => e.prompt_tokens ?? null),
            toInsert.map(e => e.completion_tokens ?? null),
            toInsert.map(e => e.total_tokens ?? null),
            toInsert.map(e => e.estimated_cost_usd ?? null),
            toInsert.map(e => e.error_type ?? null),
            toInsert.map(e => e.error_message ?? null),
            toInsert.map(e => e.metadata ? JSON.stringify(e.metadata) : null),
          ]
        );

        insertedRows = inserted.rows;
      }

      await client.query('COMMIT');
      const skipped = payloadDuplicates + (keyed.length - acceptedKeyed.length);
      return { inserted: toInsert.length, skipped, events: insertedRows };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getSummary(p: SummaryParams) {
    const conditions = ['team_id = $1', 'time_bucket >= DATE_TRUNC(\'hour\', $2::timestamptz)', 'time_bucket < $3'];
    const args: unknown[] = [p.teamId, p.from, p.to];

    if (p.provider) { args.push(p.provider); conditions.push(`provider = $${args.length}`); }
    if (p.model)    { args.push(p.model);    conditions.push(`model = $${args.length}`); }

    const where = conditions.join(' AND ');

    const [totals, byModel, series] = await Promise.all([
      this.pool.query<{
        calls: string; errors: string; prompt_tokens: string;
        completion_tokens: string; total_tokens: string; total_cost_usd: string;
        avg_latency_ms: string; p95_latency_ms: string; p99_latency_ms: string;
      }>(
        `SELECT
           COALESCE(SUM(call_count), 0)                  AS calls,
           COALESCE(SUM(error_count), 0)                 AS errors,
           COALESCE(SUM(prompt_tokens), 0)               AS prompt_tokens,
           COALESCE(SUM(completion_tokens), 0)           AS completion_tokens,
           COALESCE(SUM(total_tokens), 0)                AS total_tokens,
           COALESCE(SUM(total_cost_usd), 0)              AS total_cost_usd,
           CASE WHEN SUM(call_count) > 0
             THEN SUM(avg_latency_ms * call_count) / SUM(call_count)
             ELSE NULL
           END                                           AS avg_latency_ms,
           MAX(p95_latency_ms)                           AS p95_latency_ms,
           MAX(p99_latency_ms)                           AS p99_latency_ms
         FROM ml_llm_hourly WHERE ${where}`,
        args
      ),
      this.pool.query(
        `SELECT provider, model,
           COALESCE(SUM(call_count), 0)                  AS calls,
           COALESCE(SUM(error_count), 0)                 AS errors,
           COALESCE(SUM(prompt_tokens), 0)               AS prompt_tokens,
           COALESCE(SUM(completion_tokens), 0)           AS completion_tokens,
           COALESCE(SUM(total_tokens), 0)                AS total_tokens,
           COALESCE(SUM(total_cost_usd), 0)              AS total_cost_usd,
           CASE WHEN SUM(call_count) > 0
             THEN SUM(avg_latency_ms * call_count) / SUM(call_count)
             ELSE NULL
           END                                           AS avg_latency_ms,
           MAX(p95_latency_ms)                           AS p95_latency_ms,
           MAX(p99_latency_ms)                           AS p99_latency_ms
         FROM ml_llm_hourly WHERE ${where}
         GROUP BY provider, model ORDER BY calls DESC`,
        args
      ),
      this.pool.query(
        `SELECT time_bucket AS bucket,
           COALESCE(SUM(call_count), 0)              AS calls,
           CASE WHEN SUM(call_count) > 0
             THEN SUM(avg_latency_ms * call_count) / SUM(call_count)
             ELSE NULL
           END                                       AS avg_latency_ms,
           COALESCE(SUM(total_tokens), 0)            AS total_tokens,
           COALESCE(SUM(total_cost_usd), 0)          AS total_cost_usd
         FROM ml_llm_hourly WHERE ${where}
         GROUP BY time_bucket ORDER BY time_bucket`,
        args
      ),
    ]);

    const t = totals.rows[0];
    return {
      calls: Number(t.calls),
      errors: Number(t.errors),
      prompt_tokens: Number(t.prompt_tokens),
      completion_tokens: Number(t.completion_tokens),
      total_tokens: Number(t.total_tokens),
      total_cost_usd: Number(t.total_cost_usd),
      avg_latency_ms: t.avg_latency_ms ? Number(t.avg_latency_ms) : null,
      p95_latency_ms: t.p95_latency_ms ? Number(t.p95_latency_ms) : null,
      p99_latency_ms: t.p99_latency_ms ? Number(t.p99_latency_ms) : null,
      by_model: byModel.rows,
      timeseries: series.rows,
    };
  }

  async listEvents(p: ListParams) {
    const lim = Math.min(p.limit ?? 50, 200);
    const conditions = ['team_id = $1', 'started_at >= $2', 'started_at < $3'];
    const args: unknown[] = [p.teamId, p.from, p.to];

    if (p.provider) {
      args.push(p.provider); conditions.push(`provider = $${args.length}`);
    }

    if (p.model)    { args.push(p.model);    conditions.push(`model = $${args.length}`); }

    if (p.status)   { args.push(p.status);   conditions.push(`status = $${args.length}`); }

    if (p.cursor) {
      const cursorId = Number(Buffer.from(p.cursor, 'base64').toString());
      if (!isNaN(cursorId)) {
        args.push(cursorId);
        conditions.push(`id < $${args.length}`);
      }
    }

    const where = conditions.join(' AND ');
    args.push(lim + 1);

    const result = await this.pool.query(
      `SELECT id, idempotency_key, provider, model, operation, started_at, latency_ms, status,
              prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd,
              error_type, error_message, metadata, created_at
       FROM ml_llm_events
       WHERE ${where}
       ORDER BY id DESC
       LIMIT $${args.length}`,
      args
    );

    const hasMore = result.rows.length > lim;
    const rows = hasMore ? result.rows.slice(0, lim) : result.rows;

    const nextCursor = hasMore ? Buffer.from(String(rows[rows.length - 1].id)).toString('base64') : null;

    return { events: rows, next_cursor: nextCursor };
  }

  async getPricing(filter: { provider?: string; model?: string } = {}) {
    const conditions: string[] = [];
    const args: unknown[] = [];

    if (filter.provider) { args.push(filter.provider); conditions.push(`provider = $${args.length}`); }
    if (filter.model)    { args.push(filter.model);    conditions.push(`model = $${args.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.pool.query(
      `SELECT DISTINCT ON (provider, model)
              provider, model, input_per_million_usd, output_per_million_usd,
              currency, effective_date
       FROM ml_llm_pricing
       ${where}
       ORDER BY provider, model, effective_date DESC`,
      args
    );

    return result.rows.map(r => ({
      provider: r.provider,
      model: r.model,
      input_per_million_usd: Number(r.input_per_million_usd),
      output_per_million_usd: Number(r.output_per_million_usd),
      currency: r.currency,
      effective_date: r.effective_date,
    }));
  }

  private normalizeEvent(event: LlmEvent, index: number): LlmEvent {
    const provider = event.provider?.trim();
    const model = event.model?.trim();
    const operation = event.operation?.trim() || 'chat';
    const latencyMs = event.latency_ms ?? event.duration_ms;
    const estimatedCostUsd = event.estimated_cost_usd ?? event.cost_usd;
    const status = event.status ?? 'success';

    if (!provider || !model || !event.started_at) {
      throw new MlValidationError(`Event at index ${index} missing required fields`);
    }

    const startedAt = new Date(event.started_at);
    if (isNaN(startedAt.getTime())) {
      throw new MlValidationError(`Event at index ${index} has invalid started_at`);
    }

    if (!STATUSES.has(status)) {
      throw new MlValidationError(`Event at index ${index} has invalid status`);
    }

    if (latencyMs != null && (!Number.isInteger(latencyMs) || latencyMs < 0)) {
      throw new MlValidationError(`Event at index ${index} has invalid latency_ms`);
    }

    this.validateOptionalInteger(event.prompt_tokens, `Event at index ${index} has invalid prompt_tokens`);
    this.validateOptionalInteger(event.completion_tokens, `Event at index ${index} has invalid completion_tokens`);
    this.validateOptionalInteger(event.total_tokens, `Event at index ${index} has invalid total_tokens`);

    if (estimatedCostUsd != null && (!Number.isFinite(estimatedCostUsd) || estimatedCostUsd < 0)) {
      throw new MlValidationError(`Event at index ${index} has invalid estimated_cost_usd`);
    }

    const metadata = event.metadata;
    if (metadata != null) {
      const bytes = Buffer.byteLength(JSON.stringify(metadata), 'utf8');
      if (bytes > MAX_METADATA_BYTES) {
        throw new MlValidationError(`Event at index ${index} metadata exceeds ${MAX_METADATA_BYTES} bytes`, 'ML_METADATA_TOO_LARGE');
      }
    }

    return {
      ...event,
      provider,
      model,
      operation,
      started_at: startedAt.toISOString(),
      latency_ms: latencyMs,
      estimated_cost_usd: estimatedCostUsd,
      status,
      error_message: event.error_message?.slice(0, 500),
    };
  }

  private validateOptionalInteger(value: number | undefined, message: string) {
    if (value != null && (!Number.isInteger(value) || value < 0)) {
      throw new MlValidationError(message);
    }
  }

  private async enforceCardinalityLimit(client: { query: Pool['query'] }, teamId: string, events: LlmEvent[]) {
    const incomingPairs = new Set(events.map(e => `${e.provider}\u0000${e.model}`));
    if (incomingPairs.size === 0) return;

    const result = await client.query<{ pair_count: string }>(
      `SELECT COUNT(*) AS pair_count
       FROM (
         SELECT provider, model
         FROM ml_llm_events
         WHERE team_id = $1::uuid
         UNION
         SELECT provider, model
         FROM UNNEST($2::text[], $3::text[]) AS incoming(provider, model)
       ) pairs`,
      [
        teamId,
        events.map(e => e.provider),
        events.map(e => e.model),
      ]
    );

    if (Number(result.rows[0]?.pair_count ?? 0) > MAX_PROVIDER_MODEL_PAIRS) {
      throw new MlValidationError(
        `LLM provider/model cardinality cannot exceed ${MAX_PROVIDER_MODEL_PAIRS} pairs per team`,
        'ML_CARDINALITY_LIMIT_EXCEEDED',
        400
      );
    }
  }
}
