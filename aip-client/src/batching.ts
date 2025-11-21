import { TelemetryEvent, AIPConfig } from './types';

/**
 * EventBatcher collects events and groups them together
 *
 * Batching rules:
 * - Flush when we have 10 events (or configured batch size)
 * - Flush every 5 seconds (or configured interval)
 * - Retry failed sends 3 times before giving up
 * - Prevents concurrent flushes to avoid race conditions
 * - Deduplicates events based on request_id (keeps last 1000 unique IDs)
 */
export class EventBatcher {
  //Our main queue where events will be added to
  private queue: TelemetryEvent[] = [];

  private flushTimer: NodeJS.Timeout | null = null;
  private config: AIPConfig;
  private batchSize: number;
  private batchInterval: number;

  //dependency injection
  private sendFunction: (events: TelemetryEvent[]) => Promise<boolean>;

  private maxRetries: number = 3;

  // Concurrent flush protection
  private isFlushing: boolean = false;

  // Event deduplication set to keep track of recently processed request_ids
  private recentRequestIds: Set<string> = new Set();
  private maxDedupeSize: number = 1000;

  constructor(
    config: AIPConfig, sendFunction: (events: TelemetryEvent[]) => Promise<boolean>
  ) {
    this.config = config;

    //default to 10 for now, may change later
    this.batchSize = config.batchSize || 10;
    
    this.batchInterval = config.batchInterval || 5000;
    this.sendFunction = sendFunction;

    this.startTimer();
  }

  /**
   * Add an event to the queue
   */
  add(event: TelemetryEvent): void {
    // Deduplication check
    if (this.recentRequestIds.has(event.request_id)) {
      if (this.config.debug) {
        console.log(`AIP: Skipping duplicate event with request_id: ${event.request_id}`);
      }
      return;
    }

    this.queue.push(event);

    this.recentRequestIds.add(event.request_id);

    // Prevent Set from growing too large 
    if (this.recentRequestIds.size > this.maxDedupeSize) {
      const idsArray = Array.from(this.recentRequestIds);
      this.recentRequestIds = new Set(idsArray.slice(1));
    }

    if (this.queue.length >= this.batchSize) {
      this.autoFlush();
    }
  }

  /**
   * Automatic flush; will try to send events up to 3 times max.
   * Implements concurrent flush protection to prevent race conditions
   */
  private async autoFlush(): Promise<void> {
    if (this.isFlushing) {
      if (this.config.debug) {
        console.log('AIP: Flush operation in progress, skipping');
      }
      return;
    }

    const events = this.getEvents();
    if (events.length === 0) {
      return;
    }

    this.isFlushing = true;

    try {
      let successful = false;

      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          successful = await this.sendFunction(events);

          if (successful) {
            if (this.config.debug) {
              console.log(`AIP: Sent ${events.length} events`);
            }
            break;
          }

          if (attempt < this.maxRetries) {
            if (this.config.debug) {
              console.log(`AIP: Send failed, retrying (${attempt}/${this.maxRetries})`);
            }
            await this.sleep(500);
          }
        } catch (error) {
          if (this.config.debug) {
            console.error(`AIP: Send error on attempt ${attempt}:`, error);
          }

          if (attempt < this.maxRetries) {
            await this.sleep(500);
          }
        }
      }

      if (!successful && this.config.debug) {
        console.warn(`AIP: Failed to send ${events.length} events after ${this.maxRetries} attempts`);
      }
    } finally {
      // Always reset the flushing flag at the end
      this.isFlushing = false;
    }
  }

  /**
   * Get all events from queue and clear them
   */
  private getEvents(): TelemetryEvent[] {
    if (this.queue.length === 0) {
      return [];
    }

    const events = [...this.queue];
    this.queue = [];
    return events;
  }

  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }


  private startTimer(): void {
    this.flushTimer = setInterval(() => {
      this.autoFlush();
    }, this.batchInterval);
  }

  /**
   * Stop the batcher
   */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  getQueueSize(): number {
    return this.queue.length;  }
}
