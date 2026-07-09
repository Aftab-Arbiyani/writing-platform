import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { QueueHealthIndicator } from '../infrastructure/queue/queue-health.indicator';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';
import { StorageHealthIndicator } from './indicators/storage.health-indicator';

/**
 * Liveness/readiness/per-dependency probes (docs 14 §3). `TerminusModule`
 * supplies the built-in `TypeOrmHealthIndicator`; `RedisHealthIndicator`,
 * `QueueHealthIndicator`, and `StorageHealthIndicator` are custom probes over the
 * shared `RedisService`, the BullMQ queues (`QueueRegistry`, global), and the S3
 * media bucket (`MediaStorageService`, global) respectively.
 */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator, QueueHealthIndicator, StorageHealthIndicator],
})
export class HealthModule {}
