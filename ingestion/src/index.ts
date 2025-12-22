import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { telemetryRouter } from './routes/telemetry';
import { aggregatorRouter } from './routes/aggregator';
import { storageService } from './services/storage';
import { aggregatorService } from './services/aggregator';

dotenv.config();

const PORT = Number(process.env.PORT) || 4000;
const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const corsOptions = allowedOrigins.length > 0 ? { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true } : { origin: '*', methods: ['GET', 'POST'], credentials: false };

const requestLimiter = rateLimit({ windowMs: 60_000, max: Math.max(1, Number(process.env.RATE_LIMIT_REQUESTS) || 100), standardHeaders: true, legacyHeaders: false });

app.use(helmet());
app.use(requestLimiter);
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

app.get('/health', async (_req, res) => {
  const dbHealthy = await storageService.healthCheck();
  res.status(dbHealthy ? 200 : 503).json({ status: dbHealthy ? 'ok' : 'degraded', timestamp: new Date().toISOString(), service: 'autotrace-ingestion', dependencies: { database: dbHealthy ? 'healthy' : 'unhealthy' } });
});

app.use('/telemetry', telemetryRouter);
app.use('/aggregator', aggregatorRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

const server = app.listen(PORT, () => {
  console.log(`AutoTrace ingestion listening on ${PORT}`);

  aggregatorService.start();
});

const shutdown = (signal: string) => {
  console.log(`${signal} received. Draining connections...`);

  aggregatorService.stop();

  server.close(async closeErr => {
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
