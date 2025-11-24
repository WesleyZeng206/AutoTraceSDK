import { Request, Response, NextFunction } from 'express';
import { v4 as generateUUID } from 'uuid';
import { TelemetryEvent, AIPConfig } from './types';
import { createSender } from './sending';
import { EventBatcher } from './batching';

/**
 * Creates Express middleware that automatically handles all requests
 */
export function createAIPMiddleware(config: AIPConfig) {
  const sender = createSender(config);
  const batcher = new EventBatcher(config, sender);

  return function aipMiddleware(req: Request, res: Response, next: NextFunction) {
    const requestId = generateUUID();
    const startTime = Date.now();

    let caughtError: Error | null = null;

    // Override res.end
    const originalEnd = res.end;
    res.end = function (this: Response, ...args: any[]) {
      const duration = Date.now() - startTime;

      const event: TelemetryEvent = {
        request_id: requestId,
        service_name: config.serviceName,
        route: req.route?.path || req.path,
        method: req.method,
        status_code: res.statusCode,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      };

      if (caughtError) {
        event.error_type = caughtError.name || 'Error';
        event.error_message = caughtError.message || 'Unknown error';
      } else if (res.statusCode >= 400) {
        event.error_type = res.locals.errorType || 'HTTP_ERROR';
        event.error_message = res.locals.errorMessage || '';
      }

      batcher.add(event);

      return originalEnd.apply(this, args as any);
    } as Response['end'];

    //see if next() function throws any errors
    try {
      next();
    } catch (err) {
      if (err instanceof Error) {
        caughtError = err;
      } else {
        caughtError = new Error(String(err));
      }

      res.locals.errorType = caughtError.name;
      res.locals.errorMessage = caughtError.message;

      // pass error to express error handler
      next(err);
    }
  };
}

/**
 * Error handler middleware - put this after all routes
 * This catches errors and makes sure they get logged to telemetry
 */
export function createAIPErrorHandler(config: AIPConfig) {
  return function aipErrorHandler(err: Error, _req: Request, res: Response, next: NextFunction) {
    res.locals.errorType = err.name || 'Error';
    res.locals.errorMessage = err.message || 'Something went wrong';

    if (config.debug) {
      console.error('AIP caught error:', err);
    }

    next(err);
  };
}
