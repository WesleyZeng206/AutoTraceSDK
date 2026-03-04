CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_teams_slug ON teams(slug);
CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by);

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role);

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash VARCHAR(255) NOT NULL UNIQUE,
  key_prefix VARCHAR(20) NOT NULL,
  name VARCHAR(255),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_team ON api_keys(team_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS requests_raw (id BIGSERIAL PRIMARY KEY,
  request_id UUID NOT NULL UNIQUE,
  service_name VARCHAR(255) NOT NULL,
  route VARCHAR(500) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INT NOT NULL,
  duration_ms INT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  error_type VARCHAR(255),
  error_message TEXT,
  metadata JSONB,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_timestamp ON requests_raw(service_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_route_timestamp ON requests_raw(route, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_status ON requests_raw(status_code);
CREATE INDEX IF NOT EXISTS idx_timestamp ON requests_raw(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_request_id ON requests_raw(request_id);
CREATE INDEX IF NOT EXISTS idx_created_at ON requests_raw(created_at);
CREATE INDEX IF NOT EXISTS idx_requests_raw_team ON requests_raw(team_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_requests_raw_team_service ON requests_raw(team_id, service_name, timestamp DESC);

CREATE TABLE IF NOT EXISTS aggregated_metrics_hourly (
  id BIGSERIAL PRIMARY KEY,
  service_name VARCHAR(255) NOT NULL,
  route VARCHAR(500) NOT NULL,
  time_bucket TIMESTAMPTZ NOT NULL,
  request_count INT NOT NULL,
  error_count INT NOT NULL,
  avg_latency FLOAT NOT NULL,
  p50_latency FLOAT NOT NULL,
  p90_latency FLOAT NOT NULL,
  p95_latency FLOAT NOT NULL,
  p99_latency FLOAT NOT NULL,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, service_name, route, time_bucket)
);

CREATE INDEX IF NOT EXISTS idx_hourly_service_time ON aggregated_metrics_hourly(service_name, time_bucket DESC);
CREATE INDEX IF NOT EXISTS idx_hourly_route_time ON aggregated_metrics_hourly(route, time_bucket DESC);
CREATE INDEX IF NOT EXISTS idx_hourly_team_service_time ON aggregated_metrics_hourly(team_id, service_name, time_bucket DESC);
CREATE INDEX IF NOT EXISTS idx_hourly_team_route_time ON aggregated_metrics_hourly(team_id, route, time_bucket DESC);

CREATE OR REPLACE FUNCTION cleanup_old_events(retention_days INT DEFAULT 30)
RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM requests_raw
  WHERE timestamp < NOW() - (retention_days || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_recent_errors(p_team_id UUID, p_hours INT DEFAULT 24, p_limit INT DEFAULT 100)
RETURNS TABLE ( request_id UUID,
  service_name VARCHAR,
  route VARCHAR,
  method VARCHAR,
  status_code INT,
  duration_ms INT,
  "timestamp" TIMESTAMPTZ,
  error_type VARCHAR,
  error_message TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT r.request_id, r.service_name, r.route, r.method,
    r.status_code,
    r.duration_ms,
    r.timestamp,
    r.error_type,
    r.error_message
  FROM requests_raw r
  WHERE r.team_id = p_team_id
    AND r.status_code >= 400
    AND r.timestamp > NOW() - (p_hours || ' hours')::INTERVAL
  ORDER BY r.timestamp DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_service_health_summary(p_team_id UUID, p_hours INT DEFAULT 24)
RETURNS TABLE (
  service_name VARCHAR,
  total_requests BIGINT,
  error_count BIGINT,
  error_rate NUMERIC,
  avg_latency_ms NUMERIC,
  p95_latency_ms NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.service_name,
    COUNT(*) as total_requests,
    SUM(CASE WHEN r.status_code >= 400 THEN 1 ELSE 0 END) as error_count,
    ROUND((SUM(CASE WHEN r.status_code >= 400 THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 100), 2) as error_rate,
    ROUND(AVG(r.duration_ms)::NUMERIC, 2) as avg_latency_ms,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY r.duration_ms)::NUMERIC, 2) as p95_latency_ms
  FROM requests_raw r
  WHERE r.team_id = p_team_id
    AND r.timestamp > NOW() - (p_hours || ' hours')::INTERVAL
  GROUP BY r.service_name
  ORDER BY total_requests DESC;
END;
$$ LANGUAGE plpgsql;
