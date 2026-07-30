import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { redisConfig } from '../config/redis.config';

/**
 * BullMQ root connection on Redis logical DB 1 (ADR §3 Redis map). The named
 * queues (`scheduled-publish`, `notifications`, `media-processing`,
 * `analytics-rollup`, `trending-score`, `emails`) are registered by their
 * feature modules in Phase 1 via `BullModule.registerQueue`.
 *
 * Plain connection options (not an ioredis instance): BullMQ owns its blocking
 * connections, and `maxRetriesPerRequest: null` is required by those.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [redisConfig.KEY],
      useFactory: (redis: ConfigType<typeof redisConfig>) => {
        const url = new URL(redis.url);
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port !== '' ? url.port : 6379),
            username: url.username !== '' ? url.username : undefined,
            password: url.password !== '' ? url.password : undefined,
            db: redis.queuesDb,
            maxRetriesPerRequest: null,
          },
          prefix: 'qalam:queues',
        };
      },
    }),
  ],
})
export class QueueModule {}
