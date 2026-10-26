import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { telemetryRouter } from './routes/telemetry';
import { aggregatorRouter } from './routes/aggregator';
import { servicesRouter } from './routes/services';
import { metricsRouter } from './routes/metrics';
import { statsRouter } from './routes/stats';
import { routesRouter } from './routes/routes';
import { distributionRouter } from './routes/distribution';
import { anomaliesRealtimeRouter } from './routes/anomaliesRealtime';
import { createAuthRouter } from './routes/auth';
import { createTeamsRouter } from './routes/teams';
import { createApiKeysRouter } from './routes/apiKeys';
import healthRouter from './routes/health';
import { mlRouter } from './routes/v1/ml';
import { requireAuth } from './middleware/auth';
import { storageService } from './services/storage';
import { aggregatorService } from './services/aggregator';
import { mlAggregatorService } from './jobs/mlAggregator';
import { config, ConfigError } from './config';
import { authRateLimiter, apiRateLimiter, ipBlockingMiddleware, requestSizeValidator, maliciousPatternDetection, securityHeaders, securityLogger,} from './middleware/security';

const serverConfig = config.server;
const app = express();

if (serverConfig.trustProxy) {
  app.set('trust proxy', 1);
  console.log('Trust proxy enabled - using X-Forwarded-For for IP detection');
} else {
  console.log('Trust proxy disabled - using socket address for IP detection');
}

const allowedOrigins = serverConfig.allowedOrigins;

if (serverConfig.isProduction && allowedOrigins.length === 0) {
  console.error('FATAL: ALLOWED_ORIGINS must be set in production');
  process.exit(1);
} else {
  console.log(`CORS allowed origins: ${allowedOrigins.length}`);
}

const corsOptions = allowedOrigins.length > 0
  ? {
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      credentials: true,
      maxAge: 600,
    } : {
      origin: false,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      credentials: false,
      maxAge: 600,
    };

const origins = new Set(allowedOrigins);

const csrfCheck: express.RequestHandler = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  const cookies = typeof req.headers.cookie === 'string' && req.headers.cookie.includes('session_token=');
  const auth = typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ');

  if (!cookies) {
    return next();
  }

  if (auth) {
    return next();
  } 
  
  const h = (req.headers.origin || req.headers.referer) as string | undefined;

  if (!h) {
    return res.status(403).json({ error: 'Forbidden', message: 'Missing origin' });
  }

  try {
    const origin = new URL(h).origin;
    const hostOrigin = `${req.protocol}://${req.headers.host}`;
    
    const allowed = origins.size > 0 ? origins.has(origin) : origin === hostOrigin;

    if (allowed) {
      return next();
    }
  } catch {

  }

  return res.status(403).json({ error: 'Forbidden', message: 'Invalid origin' });
};

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
}));

app.use(securityHeaders);
app.use(securityLogger);
app.use(ipBlockingMiddleware);
app.use(maliciousPatternDetection);
app.use(requestSizeValidator);
app.use(cors(corsOptions));
app.use(csrfCheck);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/health', healthRouter);

app.use('/auth', authRateLimiter, createAuthRouter(storageService.pool));
app.use('/teams', apiRateLimiter, createTeamsRouter(storageService.pool));
app.use('/api-keys', apiRateLimiter, createApiKeysRouter(storageService.pool));

app.use('/telemetry', telemetryRouter);
app.use('/aggregator', aggregatorRouter);
app.use('/services', apiRateLimiter, servicesRouter);
app.use('/metrics', apiRateLimiter, metricsRouter);
app.use('/stats', apiRateLimiter, statsRouter);
app.use('/routes', apiRateLimiter, routesRouter);
app.use('/distribution', apiRateLimiter, distributionRouter);
app.use('/anomalies/realtime', apiRateLimiter, anomaliesRealtimeRouter);
app.use('/v1/ml', apiRateLimiter, mlRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: serverConfig.isDevelopment ? err.message : undefined });
});

function checkStartupConfig(): string | null {
  try {
    config.validate();
  } catch (error) {
    if (error instanceof ConfigError) return error.message;
    throw error;
  }

  const sessionSecret = config.security.sessionSecret;

  if (!sessionSecret || sessionSecret.length < 32) {
    return 'SESSION_SECRET must be set and at least 32 characters long';
  }

  if (serverConfig.isProduction && config.aggregator.enabled && !config.security.adminApiKey) {
    return 'API_KEY must be set during production if AGGREGATOR_ENABLED is set to true';
  }

  return null;
}

async function init() {
  const configError = checkStartupConfig();

  if (configError) {
    console.error(`FATAL: ${configError}`);
    process.exit(1);
  }

  console.log('Configuration validated');

  try {
    await storageService.initialize();
  } catch (error) {
    console.error('FATAL: Failed to initialize database connection', error);
    process.exit(1);
  }

  const server = app.listen(serverConfig.port, () => {
    console.log(`AutoTrace ingestion listening on ${serverConfig.port}`);
    aggregatorService.start();
    mlAggregatorService.start();
  });

  return server;
}

const p = init();
let server: ReturnType<typeof app.listen>;

const shutdown = async (signal: string) => {
  console.log(`${signal} received. Draining connections...`);

  aggregatorService.stop();
  mlAggregatorService.stop();

  const srv = await p;
  srv.close(async closeErr => {
    if (closeErr) {
      console.error('HTTP server failed to close cleanly', closeErr);
    }

    try {
      await storageService.close();
      console.log('Database pool closed. Bye!');
      process.exit(0);
    } catch (dbErr) {
      console.error('Database pool refused to drain', dbErr);
      process.exit(1);
    }
  });
};

['SIGTERM', 'SIGINT'].forEach(signal =>
  process.on(signal as NodeJS.Signals, () => shutdown(signal))
);
