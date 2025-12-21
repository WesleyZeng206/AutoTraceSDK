import type { Request } from 'express';
import type { TelemetryEvent } from '@autotrace/telemetry';
export type { TelemetryEvent } from '@autotrace/telemetry';

export interface RetryOptions {
  /** Maximum retry attempts for HTTP sender */
  maxRetries?: number;
  /** Base delay for exponential backoff (in milliseconds) */
  baseDelayMs?: number;
  /** Limit for exponential backoff (in milliseconds) */
  maxDelayMs?: number;
  /** Optional jitter value added to each delay */
  jitterMs?: number;
}

export interface BatchRetryOptions {
  /** Maximum retry attempts when flushing queued events */
  maxRetries?: number;
  /** Delay between retry attempts while flushing (in milliseconds) */
  delayMs?: number;
}

export interface RouteSamplingRule {
  /** Route path or prefix */
  pattern: string;
  /** Sampling rate from [0-1] */
  rate: number;
}

export interface StatusSamplingRule {
  /** The specific HTTP status codes to match */
  statuses?: number[];
  /** Minimum HTTP status code */
  min?: number;
  /** Maximum HTTP status code */
  max?: number;
  /** Sampling rate between 0 and 1 */
  rate: number;
}

export interface SamplingContext {
  event: TelemetryEvent;
  req: Request;
}

export interface SamplingOptions {
  samplingRate?: number;
  /** Always capture events that include errors */
  alwaysSampleErrors?: boolean;
  /** Capture events whose duration exceeds the threshold (ms) */
  alwaysSampleSlow?: number;
  /** Route-based sampling overrides */
  routeRules?: RouteSamplingRule[];
  /** Status-code based sampling overrides */
  statusRules?: StatusSamplingRule[];
  /** Custom callback to override sampling decisions */
  customSampler?: (context: SamplingContext) => boolean | number | undefined;
  /** Adjust sampling rate for different use cases  */
  prioritySampler?: (context: SamplingContext) => number;
  /** Salt for the consistent hashing function */
  hashSalt?: string;
}

/**
 * Configuration options for th instrumentation middleware
 */
export interface AutoTraceConfig {
  /** Name of the service (used to identify in dashboard) */
  serviceName: string;

  /** URL of the AutoTrace ingestion service endpoint */
  ingestionUrl: string;

  /** Optional API key for authentication with the ingestion service */
  apiKey?: string;

  /** Optional number of events to batch before sending */
  batchSize?: number;

  /** Max time in milliseconds to wait before flushing batch */
  batchInterval?: number;

  /** Enable debug logging to console. Default value is false */
  debug?: boolean;

  /** Buffer events locally if ingestion service is down. True by default */
  enableLocalBuffer?: boolean;

  /** Customize retry behavior for the HTTP sender */
  retryOptions?: RetryOptions;

  /** Customize retry behavior for batch flushing */
  batchRetryOptions?: BatchRetryOptions;

  /** Control sampling and filtering of events */
  sampling?: SamplingOptions;
}
