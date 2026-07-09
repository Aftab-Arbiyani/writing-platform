import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import type { Redis } from 'ioredis';

import { infrastructureConfig } from '../../config/infrastructure.config';
import { RedisService } from '../../redis/redis.service';
import { CACHE_LOCK_PREFIX } from './cache.constants';

/** Snapshot of the cache DB for the admin inspection view. */
export interface CacheStats {
  /** Total keys in the cache DB (DB 0). */
  keys: number;
  /** Key counts grouped by top-level `prefix:` namespace. */
  byPrefix: Record<string, number>;
  /** Redis `used_memory_human`, when available. */
  usedMemory: string | null;
}

/**
 * Generic cache primitive over Redis DB 0 (ADR §3). Provides the four strategies
 * Epic 11 requires — read-through (`wrap`), write-invalidate (`del`/`delByPrefix`),
 * manual refresh (`set`), and cache-stampede prevention (`wrap` takes a
 * single-flight lock so exactly one caller recomputes a cold key while the rest
 * briefly wait for the fill). Every operation degrades gracefully: a Redis
 * outage logs and falls back to the compute path rather than failing the caller
 * (matching `FeedCacheService`).
 *
 * This does NOT replace the per-module cache services — it is the reusable
 * infrastructure they and the warmer/admin surface build on. Clearing is safe
 * at DB granularity precisely because DB 0 is cache-only (flush cache without
 * touching queues in DB 1).
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(
    private readonly redis: RedisService,
    @Inject(infrastructureConfig.KEY)
    private readonly config: ConfigType<typeof infrastructureConfig>,
  ) {}

  private client(): Redis {
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

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) {
      return 0;
    }
    try {
      return await this.client().del(...keys);
    } catch (error) {
      this.logger.warn(`cache del failed: ${(error as Error).message}`);
      return 0;
    }
  }

  /**
   * Read-through with cache-stampede prevention. Returns the cached value, or
   * computes it under a single-flight Redis lock so a cold/expired key is
   * recomputed by exactly one caller; concurrent callers poll briefly for the
   * fill and only compute themselves if the lock-holder is slow (never deadlock).
   */
  async wrap<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const lockKey = `${CACHE_LOCK_PREFIX}${key}`;
    const lockTtl = this.config.cacheTtl.stampedeLock;
    const acquired = await this.acquireLock(lockKey, lockTtl);

    if (!acquired) {
      // Someone else is computing — wait for their fill, then fall back.
      const filled = await this.awaitFill<T>(key, lockTtl);
      if (filled !== null) {
        return filled;
      }
    }

    try {
      // Re-check under the lock — the holder may have filled it between our miss
      // and lock acquisition.
      const recheck = await this.get<T>(key);
      if (recheck !== null) {
        return recheck;
      }
      const fresh = await compute();
      await this.set(key, fresh, ttlSeconds);
      return fresh;
    } finally {
      if (acquired) {
        await this.releaseLock(lockKey);
      }
    }
  }

  /** SCAN + DEL every key under a prefix (write-invalidate at group granularity). */
  async delByPrefix(prefix: string): Promise<number> {
    try {
      const client = this.client();
      let cursor = '0';
      let removed = 0;
      do {
        const [next, keys] = await client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 200);
        cursor = next;
        if (keys.length > 0) {
          removed += await client.del(...keys);
        }
      } while (cursor !== '0');
      return removed;
    } catch (error) {
      this.logger.warn(`cache delByPrefix failed (${prefix}): ${(error as Error).message}`);
      return 0;
    }
  }

  /** Flush the entire cache DB (safe — DB 0 is cache-only, ADR §3). */
  async flushAll(): Promise<void> {
    try {
      await this.client().flushdb();
      this.logger.warn('cache DB 0 flushed (admin clear)');
    } catch (error) {
      this.logger.warn(`cache flush failed: ${(error as Error).message}`);
    }
  }

  /** Cache DB snapshot for the admin inspection view. */
  async stats(): Promise<CacheStats> {
    const client = this.client();
    const byPrefix: Record<string, number> = {};
    let total = 0;
    let cursor = '0';
    do {
      const [next, keys] = await client.scan(cursor, 'MATCH', '*', 'COUNT', 500);
      cursor = next;
      for (const key of keys) {
        total += 1;
        const group = key.includes(':') ? `${key.slice(0, key.indexOf(':'))}:` : key;
        byPrefix[group] = (byPrefix[group] ?? 0) + 1;
      }
    } while (cursor !== '0');

    return { keys: total, byPrefix, usedMemory: await this.usedMemory(client) };
  }

  private async usedMemory(client: Redis): Promise<string | null> {
    try {
      const info = await client.info('memory');
      const match = /used_memory_human:(.+)/.exec(info);
      return match?.[1]?.trim() ?? null;
    } catch {
      return null;
    }
  }

  private async acquireLock(lockKey: string, ttlSeconds: number): Promise<boolean> {
    try {
      const result = await this.client().set(lockKey, '1', 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch {
      // If locking is unavailable, proceed without it (correctness over throughput).
      return true;
    }
  }

  private async releaseLock(lockKey: string): Promise<void> {
    await this.del(lockKey);
  }

  /** Poll for another caller's fill for up to `maxWaitSeconds`. */
  private async awaitFill<T>(key: string, maxWaitSeconds: number): Promise<T | null> {
    const deadline = Date.now() + maxWaitSeconds * 1000;
    const stepMs = 50;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, stepMs));
      const value = await this.get<T>(key);
      if (value !== null) {
        return value;
      }
    }
    return null;
  }
}
