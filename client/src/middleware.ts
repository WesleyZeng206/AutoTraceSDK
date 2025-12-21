import { Request, Response, NextFunction } from 'express';
import { v4 as generateUUID } from 'uuid';
import { TelemetryEvent, AutoTraceConfig, SamplingOptions, SamplingContext } from './types';
import { createSender } from './sending';
import { EventBatcher } from './batching';


//just stash callbacks so GC can do its thing later
const errorCallbackMap = new WeakMap<Response, (err: Error) => void>();

/**
 * Creates Express middleware that automatically handles all requests
 */
export function createAutoTraceMiddleware(config: AutoTraceConfig) {
  const sender = createSender(config);
  const batcher = new EventBatcher(config, sender);

  return function autoTraceMiddleware(req: Request, res: Response, next: NextFunction) {
    const requestId = generateUUID();
    const startTime = Date.now();

    let caughtError: Error | null = null;
    let hasLogged = false;

    const errorCallback = (err: Error) => {
      if (!caughtError) {
        caughtError = err;
      }
    };
    errorCallbackMap.set(res, errorCallback);

    const logEvent = () => {
      if (hasLogged) {
        return;
      }
      hasLogged = true;

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
        event.error_message = caughtError.message || 'Unknown Error';
      } else if (res.locals.errorType && res.locals.errorType !== '') {
        event.error_type = res.locals.errorType;
        event.error_message = res.locals.errorMessage || '';
      } else if (res.statusCode >= 400) {
        event.error_type = 'HTTP_ERROR';
        event.error_message = '';
      }

      if (shouldSampleEvent(req, event, config.sampling)) {
        batcher.add(event);
      }
      errorCallbackMap.delete(res);
    };

    res.once('finish', logEvent);
    res.once('close', logEvent);

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

      next(err);
    }
  };
}

/**
 * Catches errors and makes sure they get logged to telemetry
 */
export function createAutoTraceErrorHandler(config: AutoTraceConfig) {
  return function autoTraceErrorHandler(err: Error, _req: Request, res: Response, next: NextFunction) {
    res.locals.errorType = err.name || 'Error';
    res.locals.errorMessage = err.message || 'Something went wrong';

    const callback = errorCallbackMap.get(res);
    if (callback) {
      callback(err);
    }

    if (config.debug) {
      console.error('AutoTrace caught error:', err);
    }

    next(err);
  };
}

function shouldSampleEvent(req: Request, event: TelemetryEvent, sampling?: SamplingOptions): boolean {
  if (!sampling) {
    return true;
  }

  const context: SamplingContext = { req, event };

  const alwaysSampleErrors = sampling.alwaysSampleErrors !== undefined ? sampling.alwaysSampleErrors : true;
  if (alwaysSampleErrors && (event.status_code >= 400 || event.error_type)) {
    return true;
  }

  if (typeof sampling.alwaysSampleSlow === 'number' && event.duration_ms >= sampling.alwaysSampleSlow) {
    return true;
  }

  let rate = clampRate(sampling.samplingRate ?? 1);

  if (Array.isArray(sampling.routeRules)) {
    const matchedRule = sampling.routeRules.find(rule => matches(event.route, rule.pattern));

    if (matchedRule) {
      rate = clampRate(matchedRule.rate);
    }
  }

  if (Array.isArray(sampling.statusRules)) {
    const matchedStatusRule = sampling.statusRules.find(rule => {
      let matches = false;
      if (Array.isArray(rule.statuses) && rule.statuses.includes(event.status_code)) {
        matches = true;
      }
      if (!matches && typeof rule.min === 'number' && typeof rule.max === 'number') {
        matches = event.status_code >= rule.min && event.status_code <= rule.max;
      }
      return matches;
    });

    if (matchedStatusRule) {
      rate = clampRate(matchedStatusRule.rate);
    }
  }

  if (typeof sampling.prioritySampler === 'function') {
    const pr = sampling.prioritySampler(context);
    if (typeof pr === 'number' && 0 < pr) {
      rate = clampRate(rate * pr);
    }
  }

  if (typeof sampling.customSampler === 'function') {
    const customDecision = sampling.customSampler(context);
    if (typeof customDecision === 'boolean') {
      return customDecision;
    }
    if (typeof customDecision === 'number') {
      rate = clampRate(customDecision);
    }
  }

  if (rate >= 1) {
    return true;
  }
  if (rate <= 0) {
    return false;
  }

  const hash = getProbability(`${event.request_id}${sampling.hashSalt || ''}`);
  return hash < rate;
}

function matches(route: string | undefined, pattern: string): boolean {
  if (!route) {
    return false;
  }

  if (pattern.includes('*')) {
    const escaped = pattern.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&').replace(/\\\*/g, '.*');
    const regex = new RegExp(`^${escaped}$`);
    return regex.test(route);
  }

  return route === pattern;
}

function clampRate(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function getProbability(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const chr = input.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return (hash >>> 0) / 0xffffffff;
}
