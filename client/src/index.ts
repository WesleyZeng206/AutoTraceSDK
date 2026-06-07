/**
 * Lightweight telemetry middleware for Express.js.
 * Entry point to the package is here.
 */

export { createAutoTraceSDKMiddleware, createAutoTraceSDKErrorHandler } from './middleware';

export type { TelemetryEvent, AutoTraceSDKConfig, PersistentQueueOptions, Extension, Filter } from './types';

export { PersistentQueue } from './persistence';

export { AutotraceML, LlmSpan } from './ml';
export type { AutotraceMLConfig, LlmSpanOptions, LlmFinishData } from './ml';


