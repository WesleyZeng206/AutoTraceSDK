import axios from 'axios';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface AutotraceMLConfig {
  apiKey: string;
  baseUrl?: string;
  flushInterval?: number;
  batchSize?: number;
  maxQueue?: number;
  timeoutMs?: number;
  diskQueuePath?: string;
  debug?: boolean;
}

export interface LlmSpanOptions {
  provider: string;
  model: string;
  operation?: string;
  metadata?: Record<string, unknown>;
}

export interface LlmFinishData {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  costUsd?: number;
  status?: 'success' | 'error' | 'timeout' | 'cancelled';
  errorType?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

interface LlmEventPayload {
  idempotency_key: string;
  provider: string;
  model: string;
  operation?: string;
  started_at: string;
  latency_ms?: number;
  status: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  estimated_cost_usd?: number;
  error_type?: string;
  error_message?: string;
  metadata?: Record<string, unknown>;
}

let counter = 0;
function newKey(): string {
  counter += 1;
  return `${process.pid}-${process.hrtime.bigint()}-${counter}`;
}

export class LlmSpan {
  private startedAt = new Date();
  private start = process.hrtime.bigint();

  constructor(
    private opts: LlmSpanOptions,
    private enqueue: (e: LlmEventPayload) => void
  ) {}

  async finish(data: LlmFinishData = {}): Promise<void> {
    const durationMs = Number((process.hrtime.bigint() - this.start) / 1000000n);

    let total = data.totalTokens;
    if (total == null && (data.promptTokens != null || data.completionTokens != null)) {
      total = (data.promptTokens ?? 0) + (data.completionTokens ?? 0);
    }

    const metadata = { ...(this.opts.metadata ?? {}), ...(data.metadata ?? {}) };

    const event: LlmEventPayload = {
      idempotency_key: newKey(),
      provider: this.opts.provider,
      model: this.opts.model,
      operation: this.opts.operation,
      started_at: this.startedAt.toISOString(),
      latency_ms: durationMs,
      status: data.status ?? 'success',
      prompt_tokens: data.promptTokens,
      completion_tokens: data.completionTokens,
      total_tokens: total,
      estimated_cost_usd: data.estimatedCostUsd ?? data.costUsd,
      error_type: data.errorType,
      error_message: data.errorMessage,
      metadata: Object.keys(metadata).length ? metadata : undefined,
    };

    this.enqueue(event);
  }
}

export class AutotraceML {
  private url: string;
  private apiKey: string;
  private flushInterval: number;
  private batchSize: number;
  private maxQueue: number;
  private timeoutMs: number;
  private diskDir?: string;
  private debug: boolean;

  private queue: LlmEventPayload[] = [];
  private timer: NodeJS.Timeout;
  private flushing = false;

  constructor(config: AutotraceMLConfig) {
    if (!config.apiKey) {
      throw new Error('apiKey is required');
    }
    const base = (config.baseUrl ?? 'http://localhost:4000').replace(/\/+$/, '');
    this.url = `${base}/v1/ml/llm/events/batch`;
    this.apiKey = config.apiKey;
    this.flushInterval = config.flushInterval ?? 5000;
    this.batchSize = config.batchSize ?? 100;
    this.maxQueue = config.maxQueue ?? 10000;
    this.timeoutMs = config.timeoutMs ?? 5000;
    this.diskDir = config.diskQueuePath;
    this.debug = config.debug ?? false;

    this.timer = setInterval(() => {
      void this.flush();
    }, this.flushInterval);
    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  llm(opts: LlmSpanOptions): LlmSpan {
    return new LlmSpan(opts, (e) => this.enqueueEvent(e));
  }

  private enqueueEvent(event: LlmEventPayload): void {
    if (this.queue.length >= this.maxQueue) {
      this.queue.shift();
    }
    this.queue.push(event);
    if (this.queue.length >= this.batchSize) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.flushing) {
      return;
    }
    this.flushing = true;
    try {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, this.batchSize);
        const ok = await this.post(batch);
        if (!ok) {
          this.spill(batch);
          return;
        }
      }
      await this.drainDisk();
    } finally {
      this.flushing = false;
    }
  }

  private async post(batch: LlmEventPayload[]): Promise<boolean> {
    try {
      await axios.post(
        this.url,
        { events: batch },
        {
          timeout: this.timeoutMs,
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'Idempotency-Key': randomUUID(),
          },
        }
      );
      return true;
    } catch (err: any) {
      const status = err?.response?.status;
      // bad payload, no point retrying
      if (typeof status === 'number' && status >= 400 && status < 500) {
        if (this.debug) console.warn(`AutotraceML: dropping batch, server returned ${status}`);
        return true;
      }
      if (this.debug) console.warn('AutotraceML: send failed:', err?.message ?? err);
      return false;
    }
  }

  private spill(batch: LlmEventPayload[]): void {
    if (!this.diskDir) {
      this.queue.unshift(...batch);
      return;
    }
    try {
      fs.mkdirSync(this.diskDir, { recursive: true });
      const file = path.join(this.diskDir, `${process.hrtime.bigint()}-${randomUUID()}.json`);
      fs.writeFileSync(file, JSON.stringify(batch));
    } catch (err: any) {
      if (this.debug) console.warn('AutotraceML: disk spill failed:', err?.message ?? err);
      this.queue.unshift(...batch);
    }
  }

  private async drainDisk(): Promise<void> {
    if (!this.diskDir || !fs.existsSync(this.diskDir)) {
      return;
    }
    const files = fs.readdirSync(this.diskDir).filter((f) => f.endsWith('.json')).sort();
    for (const name of files) {
      const file = path.join(this.diskDir, name);
      let batch: LlmEventPayload[];
      try {
        batch = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch {
        fs.rmSync(file, { force: true });
        continue;
      }
      if (await this.post(batch)) {
        fs.rmSync(file, { force: true });
      } else {
        return;
      }
    }
  }

  async close(): Promise<void> {
    clearInterval(this.timer);
    await this.flush();
  }
}
