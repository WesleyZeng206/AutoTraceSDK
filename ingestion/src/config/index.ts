import dotenv from 'dotenv';
import { EnvReader } from './envReader';

export { ConfigError, EnvReader } from './envReader';

export interface ServerConfig {
  port: number;
  nodeEnv: string;
  isProduction: boolean;
  isDevelopment: boolean;
  trustProxy: boolean;
  allowedOrigins: string[];
}

export interface SecurityConfig {
  sessionSecret: string | undefined;
  sessionDurationDays: number;
  bcryptRounds: number;
  adminApiKey: string | undefined;
}

export interface RateLimitConfig {
  apiPerMinute: number;
  telemetryPerMinute: number;
}

export interface CacheTtlConfig {
  stats: number;
  metrics: number;
  routes: number;
  services: number;
  distribution: number;
  anomalies: number;
}

export interface CacheConfig {
  enabled: boolean;
  url: string;
  ttlSeconds: CacheTtlConfig;
}

export interface AggregatorConfig {
  enabled: boolean;
  intervalMs: number;
  runOnStartup: boolean;
}

export interface AnomalyConfig {
  defaultWindowHours: number;
  maxWindowHours: number;
  minRequests: number;
  criticalThreshold: number;
  warningThreshold: number;
  minDataPoints: number;
}

// Read on access so tests can override process.env without reloading modules.
export class AppConfig {
  constructor(private readonly env: EnvReader = new EnvReader()) {}

  get server(): ServerConfig {
    const nodeEnv = this.env.string('NODE_ENV', '');

    return {
      port: this.env.int('PORT', 4000),
      nodeEnv,
      isProduction: nodeEnv === 'production',
      isDevelopment: nodeEnv === 'development',
      trustProxy: this.env.flag('TRUST_PROXY', false),
      allowedOrigins: this.env.list('ALLOWED_ORIGINS'),
    };
  }

  get security(): SecurityConfig {
    return {
      sessionSecret: this.env.optionalString('SESSION_SECRET'),
      sessionDurationDays: this.env.int('SESSION_DURATION_DAYS', 7),
      bcryptRounds: this.env.int('BCRYPT_ROUNDS', 10),
      adminApiKey: this.env.optionalString('API_KEY'),
    };
  }

  get rateLimit(): RateLimitConfig {
    return {
      apiPerMinute: this.env.positiveInt('RATE_LIMIT_REQUESTS', 100),
      telemetryPerMinute: this.env.positiveInt('TELEMETRY_RATE_LIMIT', 500),
    };
  }

  get databaseUrl(): string {
    return this.env.required(
      'DATABASE_URL',
      'DATABASE_URL not configured. Set the environment variable before starting the ingestion service.'
    );
  }

  get cache(): CacheConfig {
    return {
      enabled: this.env.flag('REDIS_ENABLED', false),
      url: this.env.string('REDIS_URL', 'redis://localhost:6379'),
      ttlSeconds: {
        stats: this.env.int('REDIS_TTL_STATS', 60),
        metrics: this.env.int('REDIS_TTL_METRICS', 60),
        routes: this.env.int('REDIS_TTL_ROUTES', 60),
        services: this.env.int('REDIS_TTL_SERVICES', 120),
        distribution: this.env.int('REDIS_TTL_DISTRIBUTION', 60),
        anomalies: this.env.int('REDIS_TTL_ANOMALIES', 60),
      },
    };
  }

  get aggregator(): AggregatorConfig {
    return {
      enabled: this.env.flag('AGGREGATOR_ENABLED', true),
      intervalMs: this.env.durationMs('AGGREGATOR_INTERVAL', '1h'),
      runOnStartup: this.env.flag('AGGREGATOR_RUN_ON_STARTUP', false),
    };
  }

  get anomaly(): AnomalyConfig {
    return {
      defaultWindowHours: this.env.int('REALTIME_ANOMALY_DEFAULT_WINDOW_HOURS', 48),
      maxWindowHours: this.env.int('REALTIME_ANOMALY_MAX_WINDOW_HOURS', 168),
      minRequests: this.env.int('REALTIME_ANOMALY_MIN_REQUESTS', 10),
      criticalThreshold: this.env.float('REALTIME_ANOMALY_CRITICAL_THRESHOLD', 3.0),
      warningThreshold: this.env.float('REALTIME_ANOMALY_WARNING_THRESHOLD', 2.0),
      minDataPoints: this.env.int('REALTIME_ANOMALY_MIN_DATA_POINTS', 5),
    };
  }

  // Getters parse lazily; touch each section to catch errors at startup.
  validate(): void {
    void this.server;
    void this.security;
    void this.rateLimit;
    void this.databaseUrl;
    void this.cache;
    void this.aggregator;
    void this.anomaly;
  }
}

// Load .env before anything reads config.
dotenv.config();

export const config = new AppConfig();
