/**
 * Lightweight telemetry middleware for Express.js.
 * Entry point to the package is here.
 */

export { createAIPMiddleware, createAIPErrorHandler } from './middleware';

export type { TelemetryEvent, AIPConfig } from './types';


