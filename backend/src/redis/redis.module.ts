import { Global, Module } from '@nestjs/common';

import { RedisService } from './redis.service';

/**
 * Provides the shared Redis client factory (`RedisService`) app-wide. Global
 * because Redis is cross-cutting infrastructure (rate limiting, auth denylist,
 * cache) that many modules will inject in Phase 1 — registering it once avoids
 * threading the import through every consumer module.
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
