import { Pool } from 'pg';

export interface LlmEvent {
  idempotency_key?: string;
  provider: string;
  model: string;
  started_at: string;
  duration_ms?: number;
  status?: 'success' | 'error' | 'timeout';
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost_usd?: number;
  metadata?: Record<string, unknown>;
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

type KeyedEvent = LlmEvent & { idempotency_key: string };

export class MlLlmService {
  constructor(private pool: Pool) {}

  async insertBatch(events: LlmEvent[], teamId: string): Promise<{ inserted: number; skipped: number }> {
    if (events.length === 0) return { inserted: 0, skipped: 0 };

    const keyed: KeyedEvent[] = [];
    const unkeyed: LlmEvent[] = [];
    const payloadSeen = new Set<string>();
    let payloadDuplicates = 0;

    for (const event of events) {
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
        const keys = keyed.map(e => e.idempotency_key!);
        const accepted = await client.query<{ key: string }>(
          `INSERT INTO ml_idempotency_keys (key, scope, team_id)
           SELECT UNNEST($1::text[]), 'llm', $2
           ON CONFLICT DO NOTHING
           RETURNING key`,
          [keys, teamId]
        );
        newlyAccepted = new Set(accepted.rows.map(r => r.key));
      }

      const acceptedKeyed = keyed.filter(e => newlyAccepted.has(e.idempotency_key));
      const toInsert = [...acceptedKeyed, ...unkeyed];

      if (toInsert.length > 0) {
        await client.query(
          `INSERT INTO ml_llm_events
             (team_id, provider, model, started_at, duration_ms, status,
              prompt_tokens, completion_tokens, total_tokens, cost_usd, metadata)
           SELECT
             $1,
             UNNEST($2::text[]),
             UNNEST($3::text[]),
             UNNEST($4::timestamptz[]),
             UNNEST($5::int[]),
             UNNEST($6::text[]),
             UNNEST($7::int[]),
             UNNEST($8::int[]),
             UNNEST($9::int[]),
             UNNEST($10::numeric[]),
             UNNEST($11::jsonb[])`,
          [teamId,
            toInsert.map(e => e.provider),
            toInsert.map(e => e.model),
            toInsert.map(e => e.started_at),
            toInsert.map(e => e.duration_ms ?? null),
            toInsert.map(e => e.status ?? 'success'),
            toInsert.map(e => e.prompt_tokens ?? null),
            toInsert.map(e => e.completion_tokens ?? null),
            toInsert.map(e => e.total_tokens ?? null),
            toInsert.map(e => e.cost_usd ?? null),
            toInsert.map(e => e.metadata ? JSON.stringify(e.metadata) : null),
          ]);
      }

      await client.query('COMMIT');
      const skipped = payloadDuplicates + (keyed.length - acceptedKeyed.length);
      return { inserted: toInsert.length, skipped };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getSummary(p: SummaryParams) {
    const conditions = ['team_id = $1', 'started_at >= $2', 'started_at < $3'];
    const args: unknown[] = [p.teamId, p.from, p.to];

    if (p.provider) { args.push(p.provider); conditions.push(`provider = $${args.length}`); }
    if (p.model)    { args.push(p.model);    conditions.push(`model = $${args.length}`); }

    const where = conditions.join(' AND ');

    const [totals, byModel, series] = await Promise.all([
      this.pool.query<{
        requests: string; errors: string; prompt_tokens: string;
        completion_tokens: string; total_tokens: string; cost_usd: string; avg_ms: string;
      }>(
        `SELECT
           COUNT(*)                                       AS requests,
           COUNT(*) FILTER (WHERE status != 'success')   AS errors,
           COALESCE(SUM(prompt_tokens), 0)               AS prompt_tokens,
           COALESCE(SUM(completion_tokens), 0)           AS completion_tokens,
           COALESCE(SUM(total_tokens), 0)                AS total_tokens,
           COALESCE(SUM(cost_usd), 0)                   AS cost_usd,
           AVG(duration_ms)                              AS avg_ms
         FROM ml_llm_events WHERE ${where}`,
        args
      ),
      this.pool.query(
        `SELECT provider, model,
           COUNT(*)                                       AS requests,
           COUNT(*) FILTER (WHERE status != 'success')   AS errors,
           COALESCE(SUM(prompt_tokens), 0)               AS prompt_tokens,
           COALESCE(SUM(completion_tokens), 0)           AS completion_tokens,
           COALESCE(SUM(total_tokens), 0)                AS total_tokens,
           COALESCE(SUM(cost_usd), 0)                   AS cost_usd,
           AVG(duration_ms)                              AS avg_ms
         FROM ml_llm_events WHERE ${where}
         GROUP BY provider, model ORDER BY requests DESC`,
        args
      ),
      this.pool.query(
        `SELECT DATE_TRUNC('hour', started_at) AS bucket,
           COUNT(*)           AS requests,
           AVG(duration_ms)   AS avg_ms,
           SUM(cost_usd)      AS cost_usd
         FROM ml_llm_events WHERE ${where}
         GROUP BY bucket ORDER BY bucket`,
        args
      ),
    ]);

    const t = totals.rows[0];
    return { requests: Number(t.requests),
      errors: Number(t.errors),
      prompt_tokens: Number(t.prompt_tokens),
      completion_tokens: Number(t.completion_tokens),
      total_tokens: Number(t.total_tokens),
      cost_usd: Number(t.cost_usd),
      avg_duration_ms: t.avg_ms ? Number(t.avg_ms) : null,
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
      `SELECT id, provider, model, started_at, duration_ms, status,
              prompt_tokens, completion_tokens, total_tokens, cost_usd, metadata, created_at
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
}
