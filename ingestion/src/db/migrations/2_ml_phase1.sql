CREATE TABLE IF NOT EXISTS ml_idempotency_keys (
  key        VARCHAR(255) NOT NULL,
  scope      VARCHAR(20)  NOT NULL,
  team_id    UUID         NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_id, scope, key)
);

CREATE INDEX IF NOT EXISTS ml_idem_created ON ml_idempotency_keys (created_at);

CREATE TABLE IF NOT EXISTS ml_llm_events (
  id            BIGINT      GENERATED ALWAYS AS IDENTITY,
  team_id       UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  provider      VARCHAR(64) NOT NULL,
  model         VARCHAR(128) NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL,
  duration_ms   INTEGER,
  status        VARCHAR(16) NOT NULL DEFAULT 'success',
  prompt_tokens  INTEGER,
  completion_tokens INTEGER,
  total_tokens  INTEGER,
  cost_usd      NUMERIC(12, 8),
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

DO $$
DECLARE
  base_start DATE;
  s DATE;
  e DATE;
  n TEXT;
BEGIN
  base_start := (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '3 months')::DATE;

  FOR m IN 0..35 LOOP
    s := (base_start + (m || ' months')::INTERVAL)::DATE;
    e := (s + INTERVAL '1 month')::DATE;
    n := 'ml_llm_events_' || TO_CHAR(s, 'YYYY_MM');
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = n) THEN
      EXECUTE FORMAT(
        'CREATE TABLE %I PARTITION OF ml_llm_events FOR VALUES FROM (%L) TO (%L)',
        n, s, e
      );
    END IF;
  END LOOP;
END;
$$;

CREATE INDEX IF NOT EXISTS ml_llm_team_time    ON ml_llm_events (team_id, started_at DESC);
CREATE INDEX IF NOT EXISTS ml_llm_team_model   ON ml_llm_events (team_id, provider, model, started_at DESC);
CREATE INDEX IF NOT EXISTS ml_llm_team_status  ON ml_llm_events (team_id, status, started_at DESC);

CREATE TABLE IF NOT EXISTS ml_llm_hourly (
  id                  BIGSERIAL PRIMARY KEY,
  team_id             UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  provider            VARCHAR(64) NOT NULL,
  model               VARCHAR(128) NOT NULL,
  time_bucket         TIMESTAMPTZ NOT NULL,
  requests            INTEGER     NOT NULL DEFAULT 0,
  errors              INTEGER     NOT NULL DEFAULT 0,
  prompt_tokens       BIGINT      NOT NULL DEFAULT 0,
  completion_tokens   BIGINT      NOT NULL DEFAULT 0,
  total_tokens        BIGINT      NOT NULL DEFAULT 0,
  cost_usd            NUMERIC(14, 8) NOT NULL DEFAULT 0,
  avg_duration_ms     NUMERIC(10, 2),
  p95_duration_ms     NUMERIC(10, 2),
  p99_duration_ms     NUMERIC(10, 2),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, provider, model, time_bucket)
);

CREATE INDEX IF NOT EXISTS ml_hourly_team_time  ON ml_llm_hourly (team_id, time_bucket DESC);
CREATE INDEX IF NOT EXISTS ml_hourly_team_model ON ml_llm_hourly (team_id, provider, model, time_bucket DESC);
