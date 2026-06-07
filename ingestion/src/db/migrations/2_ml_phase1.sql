CREATE TABLE IF NOT EXISTS ml_idempotency_keys (
  key        VARCHAR(255) NOT NULL,
  scope      VARCHAR(20)  NOT NULL,
  team_id    UUID         NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_id, scope, key)
);

CREATE INDEX IF NOT EXISTS ml_idem_created ON ml_idempotency_keys (created_at);

CREATE TABLE IF NOT EXISTS ml_llm_events (
  id                  BIGINT       GENERATED ALWAYS AS IDENTITY,
  team_id             UUID         NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  idempotency_key     VARCHAR(255),
  provider            VARCHAR(50)  NOT NULL,
  model               VARCHAR(100) NOT NULL,
  operation           VARCHAR(50)  NOT NULL DEFAULT 'chat',
  started_at          TIMESTAMPTZ  NOT NULL,
  latency_ms          INTEGER,
  status              VARCHAR(20)  NOT NULL DEFAULT 'success',
  prompt_tokens       INTEGER,
  completion_tokens   INTEGER,
  total_tokens        INTEGER,
  estimated_cost_usd  NUMERIC(12, 8),
  error_type          VARCHAR(100),
  error_message       TEXT,
  metadata            JSONB,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ml_llm_events' AND column_name = 'duration_ms'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ml_llm_events' AND column_name = 'latency_ms'
  ) THEN
    ALTER TABLE ml_llm_events RENAME COLUMN duration_ms TO latency_ms;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ml_llm_events' AND column_name = 'cost_usd'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ml_llm_events' AND column_name = 'estimated_cost_usd'
  ) THEN
    ALTER TABLE ml_llm_events RENAME COLUMN cost_usd TO estimated_cost_usd;
  END IF;
END;
$$;

ALTER TABLE ml_llm_events ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);
ALTER TABLE ml_llm_events ADD COLUMN IF NOT EXISTS operation VARCHAR(50) NOT NULL DEFAULT 'chat';
ALTER TABLE ml_llm_events ADD COLUMN IF NOT EXISTS latency_ms INTEGER;
ALTER TABLE ml_llm_events ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(12, 8);
ALTER TABLE ml_llm_events ADD COLUMN IF NOT EXISTS error_type VARCHAR(100);
ALTER TABLE ml_llm_events ADD COLUMN IF NOT EXISTS error_message TEXT;

DO $$
DECLARE
  base_start DATE;
  s DATE;
  e DATE;
  n TEXT;
BEGIN
  base_start := (CURRENT_DATE - INTERVAL '90 days')::DATE;

  FOR d IN 0..365 LOOP
    s := (base_start + (d || ' days')::INTERVAL)::DATE;
    e := (s + INTERVAL '1 day')::DATE;
    n := 'ml_llm_events_' || TO_CHAR(s, 'YYYY_MM_DD');
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = n) THEN
      EXECUTE FORMAT(
        'CREATE TABLE %I PARTITION OF ml_llm_events FOR VALUES FROM (%L) TO (%L)',
        n, s, e
      );
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ml_llm_events_default') THEN
    CREATE TABLE ml_llm_events_default PARTITION OF ml_llm_events DEFAULT;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS ml_llm_team_time    ON ml_llm_events (team_id, started_at DESC);
CREATE INDEX IF NOT EXISTS ml_llm_team_model   ON ml_llm_events (team_id, provider, model, started_at DESC);
CREATE INDEX IF NOT EXISTS ml_llm_team_status  ON ml_llm_events (team_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS ml_llm_idempotency  ON ml_llm_events (team_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS ml_llm_hourly (
  id                  BIGSERIAL PRIMARY KEY,
  team_id             UUID         NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  provider            VARCHAR(50)  NOT NULL,
  model               VARCHAR(100) NOT NULL,
  time_bucket         TIMESTAMPTZ  NOT NULL,
  call_count          INTEGER      NOT NULL DEFAULT 0,
  error_count         INTEGER      NOT NULL DEFAULT 0,
  prompt_tokens       BIGINT       NOT NULL DEFAULT 0,
  completion_tokens   BIGINT       NOT NULL DEFAULT 0,
  total_tokens        BIGINT       NOT NULL DEFAULT 0,
  total_cost_usd      NUMERIC(14, 8) NOT NULL DEFAULT 0,
  avg_latency_ms      NUMERIC(10, 2),
  p95_latency_ms      NUMERIC(10, 2),
  p99_latency_ms      NUMERIC(10, 2),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, provider, model, time_bucket)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ml_llm_hourly' AND column_name = 'requests'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ml_llm_hourly' AND column_name = 'call_count'
  ) THEN
    ALTER TABLE ml_llm_hourly RENAME COLUMN requests TO call_count;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ml_llm_hourly' AND column_name = 'errors'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ml_llm_hourly' AND column_name = 'error_count'
  ) THEN
    ALTER TABLE ml_llm_hourly RENAME COLUMN errors TO error_count;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ml_llm_hourly' AND column_name = 'cost_usd'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ml_llm_hourly' AND column_name = 'total_cost_usd'
  ) THEN
    ALTER TABLE ml_llm_hourly RENAME COLUMN cost_usd TO total_cost_usd;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ml_llm_hourly' AND column_name = 'avg_duration_ms'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ml_llm_hourly' AND column_name = 'avg_latency_ms'
  ) THEN
    ALTER TABLE ml_llm_hourly RENAME COLUMN avg_duration_ms TO avg_latency_ms;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ml_llm_hourly' AND column_name = 'p95_duration_ms'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ml_llm_hourly' AND column_name = 'p95_latency_ms'
  ) THEN
    ALTER TABLE ml_llm_hourly RENAME COLUMN p95_duration_ms TO p95_latency_ms;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ml_llm_hourly' AND column_name = 'p99_duration_ms'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ml_llm_hourly' AND column_name = 'p99_latency_ms'
  ) THEN
    ALTER TABLE ml_llm_hourly RENAME COLUMN p99_duration_ms TO p99_latency_ms;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS ml_hourly_team_time  ON ml_llm_hourly (team_id, time_bucket DESC);
CREATE INDEX IF NOT EXISTS ml_hourly_team_model ON ml_llm_hourly (team_id, provider, model, time_bucket DESC);

-- rates are USD per 1M tokens, versioned by effective_date
CREATE TABLE IF NOT EXISTS ml_llm_pricing (
  id                     BIGSERIAL PRIMARY KEY,
  provider               VARCHAR(64)  NOT NULL,
  model                  VARCHAR(128) NOT NULL,
  input_per_million_usd  NUMERIC(12, 6) NOT NULL,
  output_per_million_usd NUMERIC(12, 6) NOT NULL,
  currency               VARCHAR(8)   NOT NULL DEFAULT 'USD',
  effective_date         DATE         NOT NULL DEFAULT CURRENT_DATE,
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (provider, model, effective_date)
);

CREATE INDEX IF NOT EXISTS ml_pricing_lookup
  ON ml_llm_pricing (provider, model, effective_date DESC);

INSERT INTO ml_llm_pricing
  (provider, model, input_per_million_usd, output_per_million_usd, effective_date)
VALUES
  ('openai', 'gpt-4o',                  2.500000, 10.000000, '2025-01-01'),
  ('openai', 'gpt-4o-2024-11-20',       2.500000, 10.000000, '2025-01-01'),
  ('openai', 'gpt-4o-mini',             0.150000,  0.600000, '2025-01-01'),
  ('openai', 'gpt-4-turbo',            10.000000, 30.000000, '2025-01-01'),
  ('openai', 'gpt-4',                  30.000000, 60.000000, '2025-01-01'),
  ('openai', 'gpt-3.5-turbo',           0.500000,  1.500000, '2025-01-01'),
  ('openai', 'o1',                     15.000000, 60.000000, '2025-01-01'),
  ('openai', 'o1-mini',                 1.100000,  4.400000, '2025-01-01'),
  ('openai', 'text-embedding-3-small',  0.020000,  0.000000, '2025-01-01'),
  ('openai', 'text-embedding-3-large',  0.130000,  0.000000, '2025-01-01'),
  ('anthropic', 'claude-3-5-sonnet-20241022', 3.000000, 15.000000, '2025-01-01'),
  ('anthropic', 'claude-3-5-haiku-20241022',  0.800000,  4.000000, '2025-01-01'),
  ('anthropic', 'claude-3-opus-20240229',    15.000000, 75.000000, '2025-01-01'),
  ('anthropic', 'claude-3-sonnet-20240229',   3.000000, 15.000000, '2025-01-01'),
  ('anthropic', 'claude-3-haiku-20240307',    0.250000,  1.250000, '2025-01-01')
ON CONFLICT (provider, model, effective_date) DO NOTHING;
