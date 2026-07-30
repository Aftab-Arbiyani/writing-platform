import { Injectable, Logger } from '@nestjs/common';

import { RedisService } from '../../redis/redis.service';
import { RETRIEVAL_CACHE_PREFIX } from './retrieval.constants';

/**
 * Retrieval result cache (AF4) — a thin read-through JSON cache over Redis DB 0 (the shared
 * cache DB), the same pattern as FeedCacheService/SearchCacheService (reused, not a third
 * bespoke stack). A Redis outage degrades gracefully to a live compute — caching never
 * fails a request. Keys are namespaced under `retrieval:`; short TTLs keep results fresh
 * without a background worker (a future cache-warmer can call `set` proactively).
 */
@Injectable()
export class RetrievalCacheService {
  private readonly logger = new Logger(RetrievalCacheService.name);

  constructor(private readonly redis: RedisService) {}

  private client() {
    return this.redis.getClient('cache');
  }

  /** Build a stable, namespaced cache key from parts. */
  key(...parts: Array<string | number | boolean | undefined>): string {
    return [RETRIEVAL_CACHE_PREFIX, ...parts.map((p) => (p === undefined ? '_' : String(p)))].join(
      ':',
    );
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

  /** Read-through: return the cached value, else compute + cache. Reports whether it hit. */
  async remember<T>(
    key: string,
    ttlSeconds: number,
    compute: () => Promise<T>,
  ): Promise<{ value: T; hit: boolean }> {
    const cached = await this.get<T>(key);
    if (cached !== null) return { value: cached, hit: true };
    const fresh = await compute();
    await this.set(key, fresh, ttlSeconds);
    return { value: fresh, hit: false };
  }

  /** Best-effort invalidation of a story's cached retrievals (called on graph writes). */
  async invalidateStory(storyId: string): Promise<void> {
    try {
      const pattern = this.key('*', storyId, '*');
      const keys = await this.client().keys(pattern);
      if (keys.length > 0) await this.client().del(...keys);
    } catch (error) {
      this.logger.warn(`cache invalidate failed (${storyId}): ${(error as Error).message}`);
    }
  }
}
