import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';

/**
 * Liveness/readiness probes (docs 14). `TerminusModule` supplies the built-in
 * `TypeOrmHealthIndicator`; `RedisHealthIndicator` is our custom probe over the
 * shared `RedisService` (provided globally by `RedisModule`).
 */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator],
})
export class HealthModule {}
