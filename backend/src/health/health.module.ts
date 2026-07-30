import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { QueueHealthIndicator } from '../infrastructure/queue/queue-health.indicator';
import { HealthController } from './health.controller';
import { AiHealthIndicator } from './indicators/ai.health-indicator';
import { ConfigHealthIndicator } from './indicators/config.health-indicator';
import { PaymentHealthIndicator } from './indicators/payment.health-indicator';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';
import { SearchHealthIndicator } from './indicators/search.health-indicator';
import { StorageHealthIndicator } from './indicators/storage.health-indicator';

/**
 * Liveness/readiness/startup/per-dependency + deep aggregate probes (docs 14 §3,
 * P7.1). `TerminusModule` supplies the built-in `TypeOrmHealthIndicator`; the
 * custom indicators probe Redis, the BullMQ queues (`QueueRegistry`, global),
 * the S3 media bucket (`MediaStorageService`, global), config/secrets
 * (`ConfigInspectorService`, global), the default AI + payment providers
 * (config-readiness only), and the Postgres full-text search path.
 */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [
    RedisHealthIndicator,
    QueueHealthIndicator,
    StorageHealthIndicator,
    ConfigHealthIndicator,
    AiHealthIndicator,
    PaymentHealthIndicator,
    SearchHealthIndicator,
  ],
})
export class HealthModule {}
