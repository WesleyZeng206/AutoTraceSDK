import cors from 'cors';
import dotenv from 'dotenv';
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
import { storageService } from './services/storage';
import { aggregatorService } from './services/aggregator';
import { authRateLimiter, apiRateLimiter, ipBlockingMiddleware, requestSizeValidator, maliciousPatternDetection, securityHeaders, securityLogger,} from './middleware/security';

dotenv.config();

const PORT = Number(process.env.PORT) || 4000;
const app = express();

if (process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
  console.log('Trust proxy enabled - using X-Forwarded-For for IP detection');
}

const x = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const isProd = process.env.NODE_ENV === 'production';

if (isProd && x.length === 0) {
  console.error('FATAL: ALLOWED_ORIGINS must be set in production');
  process.exit(1);
}

const corsOptions = x.length > 0
  ? {
      origin: x,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      credentials: true,
      maxAge: 600,
    } : {
      origin: false,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      credentials: false,
      maxAge: 600,
    };

const allowedOrigins = new Set(x);

const csrfGuard: express.RequestHandler = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  const cookies = typeof req.headers.cookie === 'string' && req.headers.cookie.includes('session_token=');
  const auth = typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ');

  if (!cookies || auth){
    return next();
  } 
  const h = (req.headers.origin || req.headers.referer) as string | undefined;

  if (!h) {
    return res.status(403).json({ error: 'Forbidden', message: 'Missing origin' });
  }

  try {
    const origin = new URL(h).origin;
    const hostOrigin = `${req.protocol}://${req.headers.host}`;
    
    const allowed = allowedOrigins.size > 0 ? allowedOrigins.has(origin) : origin === hostOrigin;

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
app.use(csrfGuard);
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

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

async function startServer() {

  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    console.error('FATAL: SESSION_SECRET must be set and at least 32 characters long');
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production') {
    const aggEn = String(process.env.AGGREGATOR_ENABLED ?? 'true').toLowerCase() !== 'false';

    if (aggEn && !process.env.API_KEY) {
      console.error('FATAL: API_KEY must be set during production if AGGREGATOR_ENABLED is set to true');
      process.exit(1);
    }
  }

  try {
    await storageService.initialize();
  } catch (error) {
    console.error('FATAL: Failed to initialize database connection', error);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`AutoTrace ingestion listening on ${PORT}`);
    aggregatorService.start();
  });

  return server;
}

const serverPromise = startServer();
let server: ReturnType<typeof app.listen>;

const shutdown = async (signal: string) => {
  console.log(`${signal} received. Draining connections...`);

  aggregatorService.stop();

  const srv = await serverPromise;
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
