
import { TelemetryEvent, AIPConfig } from './types';

// Possible circuit breaker states
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

// Default configuration values
const TIMEOUT_MS = 5000;
const MAX_RETRIES = 3;
const CIRCUIT_THRESHOLD = 5;  
const CIRCUIT_RESET_MS = 30000;  

/**
 * Result of a send operation
 */
interface SendResult {
  success: boolean;
  statusCode?: number;
  eventsAccepted?: number;
  error?: string;
}

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number | null;
  successCount: number;
}

/**
 * Creates a sender function that can be passed to the EventBatcher
 * Sender function returns a promise of a boolean 
 */
export function createSender(config: AIPConfig): (events: TelemetryEvent[]) => Promise<boolean> {
  let circuitState = createInitialCircuitState();
  const circuitThreshold = CIRCUIT_THRESHOLD;
  const circuitResetMs = CIRCUIT_RESET_MS;
  const timeoutMs = TIMEOUT_MS;
  const maxRetries = MAX_RETRIES;

  return async (events: TelemetryEvent[]): Promise<boolean> => {
    if (events.length === 0) {
      return true;
    }

    if (!shouldAllowRequest(circuitState, circuitResetMs)) {
      if (config.debug) {
        console.log('AIP: Circuit breaker is open, rejecting the request');
      }
      return false;
    }

    if (circuitState.state === 'OPEN') {
      circuitState = { ...circuitState, state: 'HALF_OPEN', successCount: 0 };
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await sendHttpRequest(config.ingestionUrl, events, config.apiKey, timeoutMs);

      if (result.success) {
        circuitState = updateCircuitState(circuitState, true, circuitThreshold);
        if (config.debug) {
          console.log(`AIP: Successfully sent ${events.length} events`);
        }
        return true;
      }

      if (config.debug) {
        console.log(`AIP: Send attempt ${attempt}/${maxRetries} failed: ${result.error}`);
      }

      if (attempt < maxRetries) {
        const delay = calculateBackoffDelay(attempt);
        await sleep(delay);
      }
    }

    circuitState = updateCircuitState(circuitState, false, circuitThreshold);
    return false;
  };
}

async function sendHttpRequest(
  url: string,
  events: TelemetryEvent[],
  apiKey?: string,
  timeoutMs: number = TIMEOUT_MS
): Promise<SendResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['API_Key'] = apiKey;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ events }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return {
        success: true,
        statusCode: response.status,
        eventsAccepted: events.length,
      };
    }

    return {
      success: false,
      statusCode: response.status,
      error: `HTTP ${response.status}: ${response.statusText}`,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return { success: false, error: 'Request timeout' };
      }
      return { success: false, error: error.message };
    }

    return { success: false, error: 'UnknownError' };
  }
}

function shouldAllowRequest(
  state: CircuitBreakerState,
  resetMs: number = CIRCUIT_RESET_MS
): boolean {
  if (state.state === 'CLOSED') {
    return true;
  }

  if (state.state === 'OPEN') {
    if (state.lastFailureTime === null) {
      return true;
    }
    const timeSinceFailure = Date.now() - state.lastFailureTime;
    return timeSinceFailure >= resetMs;
  }

  if (state.state === 'HALF_OPEN') {
    return state.successCount < 3;
  }

  return true;
}

function updateCircuitState(
  state: CircuitBreakerState,
  success: boolean,
  threshold: number = CIRCUIT_THRESHOLD
): CircuitBreakerState {
  if (success === true) {
    if (state.state === 'CLOSED') {
      return { ...state, failureCount: 0 };
    }

    if (state.state === 'HALF_OPEN') {
      const newSuccessCount = state.successCount + 1;
      if (newSuccessCount >= 3) {
        return createInitialCircuitState();
      }
      return { ...state, successCount: newSuccessCount };
    }

    return state;
  }

  if (state.state === 'CLOSED') {
    const newFailureCount = state.failureCount + 1;
    if (newFailureCount >= threshold) {
      return {
        state: 'OPEN',
        failureCount: newFailureCount,
        lastFailureTime: Date.now(),
        successCount: 0,
      };
    }
    return { ...state, failureCount: newFailureCount, lastFailureTime: Date.now() };
  }

  if (state.state === 'HALF_OPEN') {
    return {
      state: 'OPEN',
      failureCount: state.failureCount + 1,
      lastFailureTime: Date.now(),
      successCount: 0,
    };
  }

  return { ...state, lastFailureTime: Date.now() };
}

function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number = 100,
  maxDelayMs: number = 5000
): number {
  //Calculations here are conventional; we can tune them later
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
  const jitter = Math.random() * 100;
  return cappedDelay + jitter;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * A default Circuit State creator
 */
function createInitialCircuitState(): CircuitBreakerState {
  return {
    state: 'CLOSED',
    failureCount: 0,
    lastFailureTime: null,
    successCount: 0
  };
}
