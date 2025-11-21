/**
 * This will represent a single telemetry event captured by the middleware
 */
export interface TelemetryEvent {
  /** The unique identifier for this request; we use UUID here */
  request_id: string;

  /** Name of the service generating this event */
  service_name: string;

  /** HTTP route */
  route: string;

  /** HTTP method */
  method: string;

  /** HTTP response status code */
  status_code: number;

  /** ISO-8601 timestamp of when the request completed */
  timestamp: string;

  /** Request's duration in milliseconds */
  duration_ms: number;

  /** Type of error if the request failed */
  error_type?: string;

  /** Error message for humans to read */
  error_message?: string;

  /** Additional metadata, including user_id, custom fields, etc. */
  metadata?: Record<string, any>;
}

/**
 * Configuration options for th instrumentation middleware
 */
export interface AIPConfig {
  /** Name of the service (used to identify in dashboard) */
  serviceName: string;

  /** URL of the AIP ingestion service endpoint */
  ingestionUrl: string;

  /** Optional API key for authentication with the ingestion service */
  apiKey?: string;

  /** Optional number of events to batch before sending */
  batchSize?: number;

  /** Max time in milliseconds to wait before flushing batch */
  batchInterval?: number;

  /** Enable debug logging to console (default: false) */
  debug?: boolean;

  /** Buffer events locally if ingestion service is down (default: true) */
  enableLocalBuffer?: boolean;
}
