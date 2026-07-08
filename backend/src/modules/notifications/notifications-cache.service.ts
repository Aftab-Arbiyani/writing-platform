import { Injectable, Logger } from '@nestjs/common';

import { RedisService } from '../../redis/redis.service';
import { NOTIFICATION_CACHE_KEYS, NOTIFICATION_CACHE_TTL } from './notifications.constants';

/**
 * Redis (DB 0) cache for the unread badge count (E9 perf). The count is read on
 * every page load, so it is cached read-through and invalidated explicitly on
 * every state change (create, read, archive, delete). A short TTL is only a
 * safety net. Degrades gracefully — a Redis outage falls back to a live count,
 * never an error (mirrors `FeedCacheService`/`SearchCacheService`).
 */
@Injectable()
export class NotificationsCacheService {
  private readonly logger = new Logger(NotificationsCacheService.name);

  constructor(private readonly redis: RedisService) {}

  private client() {
    return this.redis.getClient('cache');
  }

  /** Read-through unread count. `compute` runs on a miss (or any cache error). */
  async getUnreadCount(userId: string, compute: () => Promise<number>): Promise<number> {
    const key = NOTIFICATION_CACHE_KEYS.unreadCount(userId);
    try {
      const raw = await this.client().get(key);
      if (raw !== null) {
        const cached = Number(raw);
        if (Number.isFinite(cached)) {
          return cached;
        }
      }
    } catch (error) {
      this.logger.warn(`unread-count cache get failed: ${(error as Error).message}`);
    }
    const fresh = await compute();
    try {
      await this.client().set(key, String(fresh), 'EX', NOTIFICATION_CACHE_TTL.unreadCount);
    } catch (error) {
      this.logger.warn(`unread-count cache set failed: ${(error as Error).message}`);
    }
    return fresh;
  }

  /** Invalidate one user's cached unread count. */
  async invalidate(userId: string): Promise<void> {
    await this.invalidateMany([userId]);
  }

  /** Invalidate many users' caches (broadcast fan-out). */
  async invalidateMany(userIds: string[]): Promise<void> {
    if (userIds.length === 0) {
      return;
    }
    try {
      await this.client().del(...userIds.map((id) => NOTIFICATION_CACHE_KEYS.unreadCount(id)));
    } catch (error) {
      this.logger.warn(`unread-count cache invalidate failed: ${(error as Error).message}`);
    }
  }
}
