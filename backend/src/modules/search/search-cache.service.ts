import { Injectable, Logger } from '@nestjs/common';

import { RedisService } from '../../redis/redis.service';

/**
 * Thin JSON cache over Redis DB 0 for the two cacheable search reads —
 * autocomplete and trending (docs 18 E8 perf). Reads/writes degrade gracefully:
 * a Redis outage logs and falls back to a live query rather than failing the
 * request. Invalidation is TTL-driven (short TTLs = the recompute cadence,
 * no background worker) — mirrors `FeedCacheService`, which lives in the feed
 * module and is not exported, so search keeps its own thin copy over the shared
 * `RedisService` primitive.
 */
@Injectable()
export class SearchCacheService {
  private readonly logger = new Logger(SearchCacheService.name);

  constructor(private readonly redis: RedisService) {}

  private client() {
    return this.redis.getClient('cache');
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client().get(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch (error) {
      this.logger.warn(`cache get failed (${key}): ${(error as Error).message}`);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.client().set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn(`cache set failed (${key}): ${(error as Error).message}`);
    }
  }

  /**
   * Read-through: return the cached value or compute it, cache it, and return it.
   * A cache failure never blocks the compute path.
   */
  async remember<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    const fresh = await compute();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }
}
