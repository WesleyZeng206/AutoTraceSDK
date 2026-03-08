import { storageService } from '../services/storage';

class MlAggregatorService {
  private timer: NodeJS.Timeout | null = null;
  private busy = false;

  start() {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      this.run().catch(err => console.error('ML aggregator error:', err));
    }, 5 * 60 * 1000);

    this.run().catch(err => console.error('ML aggregator startup error:', err));
    console.log('ML aggregator running every 5 minutes');
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async run() {
    if (this.busy) return;
    this.busy = true;

    try {
      await Promise.all([this.rollupLlm(), this.purgeIdemKeys()]);
    } finally {
      this.busy = false;
    }
  }

  private async rollupLlm() {
    const pool = storageService.pool;
    await pool.query(`
      INSERT INTO ml_llm_hourly
        (team_id, provider, model, time_bucket,
         requests, errors, prompt_tokens, completion_tokens, total_tokens,
         cost_usd, avg_duration_ms, p95_duration_ms, p99_duration_ms)
      SELECT
        team_id,
        provider,
        model,
        DATE_TRUNC('hour', started_at)         AS time_bucket,
        COUNT(*)                               AS requests,
        COUNT(*) FILTER (WHERE status != 'success') AS errors,
        COALESCE(SUM(prompt_tokens), 0)        AS prompt_tokens,
        COALESCE(SUM(completion_tokens), 0)    AS completion_tokens,
        COALESCE(SUM(total_tokens), 0)         AS total_tokens,
        COALESCE(SUM(cost_usd), 0)            AS cost_usd,
        AVG(duration_ms)                       AS avg_duration_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_duration_ms,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99_duration_ms
      FROM ml_llm_events
      WHERE created_at >= NOW() - INTERVAL '3 hours'
      GROUP BY team_id, provider, model, DATE_TRUNC('hour', started_at)
      ON CONFLICT (team_id, provider, model, time_bucket) DO UPDATE SET
        requests          = EXCLUDED.requests,
        errors            = EXCLUDED.errors,
        prompt_tokens     = EXCLUDED.prompt_tokens,
        completion_tokens = EXCLUDED.completion_tokens,
        total_tokens      = EXCLUDED.total_tokens,
        cost_usd          = EXCLUDED.cost_usd,
        avg_duration_ms   = EXCLUDED.avg_duration_ms,
        p95_duration_ms   = EXCLUDED.p95_duration_ms,
        p99_duration_ms   = EXCLUDED.p99_duration_ms,
        updated_at        = NOW() `);
  }

  private async purgeIdemKeys() {
    await storageService.pool.query(
      `DELETE FROM ml_idempotency_keys WHERE created_at < NOW() - INTERVAL '25 hours'`
    );
  }
}

export const mlAggregatorService = new MlAggregatorService();
