import { Injectable, Logger } from '@nestjs/common';
import { VIEW_DEDUP_COOLDOWN_SECONDS } from '@qalam/shared';

import { RedisService } from '../../redis/redis.service';
import { ANALYTICS_CACHE_KEYS } from './analytics.constants';

/**
 * Redis (DB 0) for analytics: the per-viewer view cooldown (prevents duplicate
 * counting / refresh-spam) and a read-through cache for the expensive computed
 * reads (platform + trending). Degrades gracefully — a Redis outage never fails a
 * request (view counting falls back to "count it"; unique-view dedup still holds
 * via the DB unique index).
 */
@Injectable()
export class AnalyticsCacheService {
  private readonly logger = new Logger(AnalyticsCacheService.name);

  constructor(private readonly redis: RedisService) {}

  private client() {
    return this.redis.getClient('cache');
  }

  /**
   * Claims a countable view for (piece, viewer): true if outside the cooldown
   * (count it), false if a view was already counted within the window.
   */
  async claimView(pieceId: string, viewerKey: string): Promise<boolean> {
    const key = ANALYTICS_CACHE_KEYS.viewCooldown(pieceId, viewerKey);
    try {
      const result = await this.client().set(key, '1', 'EX', VIEW_DEDUP_COOLDOWN_SECONDS, 'NX');
      return result === 'OK';
    } catch (error) {
      this.logger.warn(`view cooldown check failed (counting anyway): ${(error as Error).message}`);
      return true;
    }
  }

  /**
   * Live Redis (DB 0) health for the admin system-analytics endpoint (E12.9):
   * keyspace hit ratio, used memory, and key count. All fields degrade to null on
   * a Redis blip (never fails the request).
   */
  async systemStats(): Promise<{
    hitRatio: number | null;
    usedMemoryBytes: number | null;
    keys: number | null;
  }> {
    try {
      const client = this.client();
      const [stats, memory, keys] = await Promise.all([
        client.info('stats'),
        client.info('memory'),
        client.dbsize(),
      ]);
      const hits = Number(/keyspace_hits:(\d+)/.exec(stats)?.[1] ?? 0);
      const misses = Number(/keyspace_misses:(\d+)/.exec(stats)?.[1] ?? 0);
      const usedMemory = /used_memory:(\d+)/.exec(memory)?.[1];
      return {
        hitRatio: hits + misses > 0 ? hits / (hits + misses) : null,
        usedMemoryBytes: usedMemory !== undefined ? Number(usedMemory) : null,
        keys,
      };
    } catch (error) {
      this.logger.warn(`analytics system stats failed: ${(error as Error).message}`);
      return { hitRatio: null, usedMemoryBytes: null, keys: null };
    }
  }

  /** Read-through cache for a computed payload. Cache failure never blocks compute. */
  async remember<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
    try {
      const raw = await this.client().get(key);
      if (raw !== null) {
        return JSON.parse(raw) as T;
      }
    } catch (error) {
      this.logger.warn(`analytics cache get failed (${key}): ${(error as Error).message}`);
    }
    const fresh = await compute();
    try {
      await this.client().set(key, JSON.stringify(fresh), 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn(`analytics cache set failed (${key}): ${(error as Error).message}`);
    }
    return fresh;
  }
}
