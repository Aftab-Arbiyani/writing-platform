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
