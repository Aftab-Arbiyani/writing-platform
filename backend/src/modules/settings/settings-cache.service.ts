import { Injectable, Logger } from '@nestjs/common';

import { RedisService } from '../../redis/redis.service';

/**
 * Thin JSON cache over Redis DB 0 for the hot settings reads — the full settings
 * map, feature flags, and maintenance state (E12.8). Mirrors `SearchCacheService`
 * (each module keeps its own thin copy over the shared `RedisService` primitive
 * rather than cross-importing). Every read/write degrades gracefully: a Redis
 * outage logs and falls back to the live query rather than failing the request.
 *
 * Invalidation is EXPLICIT — a mutation deletes the affected keys — with a TTL as
 * the safety net (docs 18 — cache + auto-invalidate after updates).
 */
@Injectable()
export class SettingsCacheService {
  private readonly logger = new Logger(SettingsCacheService.name);

  constructor(private readonly redis: RedisService) {}

  private client() {
    return this.redis.getClient('cache');
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client().get(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch (error) {
      this.logger.warn(`settings cache get failed (${key}): ${(error as Error).message}`);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.client().set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn(`settings cache set failed (${key}): ${(error as Error).message}`);
    }
  }

  /** Read-through: return the cached value or compute, cache, and return it. */
  async remember<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    const fresh = await compute();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }

  /** Deletes one or more cache keys after a mutation (best-effort). */
  async invalidate(...keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }
    try {
      await this.client().del(...keys);
    } catch (error) {
      this.logger.warn(`settings cache invalidate failed: ${(error as Error).message}`);
    }
  }
}
