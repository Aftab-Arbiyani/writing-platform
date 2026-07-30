import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Redis } from 'ioredis';

import { redisConfig } from '../config/redis.config';

/** Logical Redis databases (ADR §3): one instance, purpose-separated by DB index. */
export type RedisPurpose = 'cache' | 'queues' | 'rateLimit' | 'auth';

/**
 * Provides lazily-created ioredis clients, one per logical DB (ADR §3 map:
 * 0 cache · 1 queues · 2 rate-limit · 3 auth). Clients are memoized per purpose
 * and closed on shutdown (`enableShutdownHooks` in main.ts drives this), so we
 * open at most one connection per purpose and leak none.
 *
 * BullMQ manages its own connections (see `QueueModule`); this service serves
 * the rate-limit guard (DB 2) and the auth refresh-denylist (DB 3) that arrive
 * in Epic 1.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly clients = new Map<RedisPurpose, Redis>();

  constructor(@Inject(redisConfig.KEY) private readonly config: ConfigType<typeof redisConfig>) {}

  /** Returns the memoized client for a logical DB, creating it on first use. */
  getClient(purpose: RedisPurpose): Redis {
    const existing = this.clients.get(purpose);
    if (existing !== undefined) {
      return existing;
    }

    const client = new Redis(this.config.url, {
      db: this.dbIndex(purpose),
      // Fail fast rather than queue commands forever when Redis is unreachable.
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
    client.on('error', (error: Error) => {
      this.logger.error(`Redis (${purpose}) connection error: ${error.message}`);
    });

    this.clients.set(purpose, client);
    return client;
  }

  private dbIndex(purpose: RedisPurpose): number {
    switch (purpose) {
      case 'cache':
        return this.config.cacheDb;
      case 'queues':
        return this.config.queuesDb;
      case 'rateLimit':
        return this.config.rateLimitDb;
      case 'auth':
        return this.config.authDb;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      [...this.clients.values()].map((client) => client.quit().catch(() => undefined)),
    );
    this.clients.clear();
  }
}
