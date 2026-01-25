import Redis from 'ioredis';
import type { Redis as RedisClient } from 'ioredis';

export class CacheService {
  private client?: RedisClient;
  private enabled: boolean;
  private ownsClient: boolean;
  private stats = { hits: 0, misses: 0, errors: 0 };

  constructor(client?: RedisClient, enabled?: boolean) {
    this.ownsClient = false;
    if (client) {
      this.client = client;
      this.enabled = enabled ?? true;
      return;
    }

    this.enabled = enabled ?? process.env.REDIS_ENABLED === 'true';
    if (this.enabled) {
      this.client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        retryStrategy: times => Math.min(times * 50, 2000),
        maxRetriesPerRequest: 3,
      });
      this.ownsClient = true;
      this.client.on('connect', () => console.log('Redis connected'));
      this.client.on('error', err => console.error('Redis error:', err));
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled || !this.client) return null;

    try {
      const data = await this.client.get(key);
      if (data) {
        this.stats.hits++;
        return JSON.parse(data);
      } else {
        this.stats.misses++;
        return null;
      }
    } catch (err) {
      console.error('Cache get error:', err);
      this.stats.errors++;
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    if (!this.enabled || !this.client) return;

    try {
      const serialized = JSON.stringify(value);

      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (err) {
      console.error('Cache set error:', err);

      this.stats.errors++;
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.enabled || !this.client) return;

    try {
      let cursor = '0';
      const keysToDelete: string[] = [];

      do {

        const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;

        if (keys.length > 0) {
          keysToDelete.push(...keys);
        }

      } while (cursor !== '0');

      if (keysToDelete.length > 0) {
        await this.client.del(...keysToDelete);
      }
    } catch (err) {
      console.error('Cache invalidation error:', err);
      this.stats.errors++;
    }
  }

  async invalidate(key: string): Promise<void> {
    if (!this.enabled || !this.client) return;

    try {
      await this.client.del(key);
    } catch (err) {
      console.error('Cache invalidation error:', err);
      this.stats.errors++;
    }
  }

  async ping(): Promise<boolean> {
    if (!this.enabled || !this.client) return false;

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return { ...this.stats, hitRate: total > 0 ? this.stats.hits / total : 0 };
  }

  resetStats() {
    this.stats = { hits: 0, misses: 0, errors: 0 };
  }

  async shutdown() {
    if (this.client && this.ownsClient) {
      try {
        await this.client.quit();
      } catch (err) {
        console.error('Redis shutdown error:', err);
      }
    }
    this.client = undefined;
    this.enabled = false;
    this.ownsClient = false;
  }
}

export const cacheService = new CacheService();
