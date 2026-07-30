import { Injectable, Logger } from '@nestjs/common';

import { RedisService } from '../../redis/redis.service';

/** Stable Redis cache keys for the feed/discovery caches (docs 18 E6 task 4). */
export const FEED_CACHE_KEYS = {
  trending: 'feed:trending:v1',
  featuredWriters: 'discover:writers:featured:v1',
  popularWritersFirstPage: (limit: number) => `discover:writers:popular:v1:${limit}`,
  trendingTags: 'discover:tags:v1',
  trendingGenres: 'discover:genres:v1',
  trendingLanguages: 'discover:languages:v1',
} as const;

/**
 * Thin JSON cache over Redis DB 0 (the shared cache DB, ADR §3). Reads/writes
 * degrade gracefully — a Redis outage logs and falls back to a live query rather
 * than failing the request. Invalidation is TTL-driven (short TTLs = the
 * recompute cadence without a background worker) plus the explicit `invalidate*`
 * methods here, which a future domain-event wiring can call on publish/engagement.
 */
@Injectable()
export class FeedCacheService {
  private readonly logger = new Logger(FeedCacheService.name);

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
   * Read-through helper: return the cached value or compute it, cache it, return
   * it. A cache failure never blocks the compute path.
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

  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }
    try {
      await this.client().del(...keys);
    } catch (error) {
      this.logger.warn(`cache del failed: ${(error as Error).message}`);
    }
  }

  /** Invalidate the trending feed snapshot (e.g. after a burst of engagement). */
  invalidateTrending(): Promise<void> {
    return this.del(FEED_CACHE_KEYS.trending);
  }

  /** Invalidate the discovery caches (e.g. after a publish changes the landscape). */
  invalidateDiscovery(): Promise<void> {
    return this.del(
      FEED_CACHE_KEYS.featuredWriters,
      FEED_CACHE_KEYS.trendingTags,
      FEED_CACHE_KEYS.trendingGenres,
      FEED_CACHE_KEYS.trendingLanguages,
    );
  }
}
