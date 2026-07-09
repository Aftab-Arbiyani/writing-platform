import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { QueueHealthIndicator } from '../infrastructure/queue/queue-health.indicator';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';

/**
 * Liveness/readiness probes (docs 14). `TerminusModule` supplies the built-in
 * `TypeOrmHealthIndicator`; `RedisHealthIndicator` and `QueueHealthIndicator`
 * are custom probes over the shared `RedisService` and the BullMQ queues (the
 * latter injects the globally-exported `QueueRegistry` from InfrastructureModule).
 */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator, QueueHealthIndicator],
})
export class HealthModule {}
