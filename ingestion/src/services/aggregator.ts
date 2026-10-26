import { storageService } from './storage';
import { cacheService } from './cache';
import { config } from '../config';

type Cfg = { enabled: boolean; interval: number; runOnStartup: boolean };
const MAX_WINDOWS = 24 * 31;

export class AggregatorBusyError extends Error {
  constructor() {
    super('Aggregator already running');
  }
}

export class AggregatorService {
  private timer: NodeJS.Timeout | null = null;
  private cfg: Cfg;
  private busy = false;
  private last: Date | null = null;

  constructor(overrides: Partial<Cfg> = {}) {
    const defaults = config.aggregator;

    this.cfg = {
      enabled: overrides.enabled ?? defaults.enabled,
      interval: overrides.interval ?? defaults.intervalMs,
      runOnStartup: overrides.runOnStartup ?? defaults.runOnStartup,
    };
  }

  start() {
    if (!this.cfg.enabled || this.timer) return;
    if (this.cfg.interval < 60_000) throw new Error('Interval too short: minimum 1 minute');

    this.timer = setInterval(() => {
      this.run().catch(err => console.error('Aggregation failed:', err));
    }, this.cfg.interval);

    console.log('Aggregator running every ' + formatInterval(this.cfg.interval));

    if (this.cfg.runOnStartup) {
      this.run().catch(err => console.error('Initial aggregation failed:', err));
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async run(): Promise<void> {
    const windows = this.buildWindows();
    if (windows.length === 0) return;
    await this.runBatches(windows);
  }

  async runRange(start: Date, end: Date): Promise<void> {
    const s = this.align(start);
    const e = this.align(end);
    if (!(s < e)) throw new Error('Invalid range: start must be before end');

    const batches: Array<[Date, Date]> = [];
    let cursor = s;
    let iterations = 0;

    while (cursor < e) {
      if (++iterations > MAX_WINDOWS) {
        throw new Error('Invalid range: too many hourly windows requested');
      }

      const next = new Date(cursor);
      next.setHours(next.getHours() + 1);
      batches.push([new Date(cursor), next]);
      cursor = next;
    }

    await this.runBatches(batches);
  }

  getStatus() {
    return {
      enabled: this.cfg.enabled && !!this.timer,
      interval: formatInterval(this.cfg.interval),
      running: this.busy,
      lastWindowEnd: this.last ? this.last.toISOString() : null
    };
  }

  private async runBatches(batches: Array<[Date, Date]>) {
    if (this.busy) throw new AggregatorBusyError();
    this.busy = true;
    const started = Date.now();

    try {
      for (const [s, e] of batches) {
        await storageService.computeHourlyAggregates(s, e);
        this.last = e;
      }

      await cacheService.invalidatePattern('stats:*');
      await cacheService.invalidatePattern('metrics:*');
      await cacheService.invalidatePattern('routes:*');

      const label = batches.map(([s, e]) => s.toISOString() + '->' + e.toISOString()).join(', ');
      console.log('Aggregated ' + label + ' in ' + (Date.now() - started) + 'ms');
    } finally {
      this.busy = false;
    }
  }

  private buildWindows(): Array<[Date, Date]> {
    const now = this.align(new Date());
    const baseCandidate = this.last ?? new Date(now.getTime() - 60 * 60 * 1000);
    const base = baseCandidate > now ? now : baseCandidate;

    const windows: Array<[Date, Date]> = [];
    let cursor = base;
    let iterations = 0;

    while (cursor < now) {
      if (++iterations > MAX_WINDOWS) {
        throw new Error('Too many pending aggregation windows; check last run timestamp');
      }

      const next = new Date(cursor);
      next.setHours(next.getHours() + 1);
      windows.push([new Date(cursor), next]);
      cursor = next;
    }

    return windows;
  }

  private align(d: Date) {
    const x = new Date(d);
    x.setMinutes(0, 0, 0);
    return x;
  }
}

function formatInterval(ms: number): string {
  if (ms % (24 * 60 * 60 * 1000) === 0) return ms / (24 * 60 * 60 * 1000) + 'd';
  if (ms % (60 * 60 * 1000) === 0) return ms / (60 * 60 * 1000) + 'h';
  if (ms % (60 * 1000) === 0) return ms / (60 * 1000) + 'm';
  if (ms % 1000 === 0) return ms / 1000 + 's';
  return ms + 'ms';
}

export const aggregatorService = new AggregatorService();
