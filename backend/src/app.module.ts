/**
 * Root module — composes the infrastructure modules and mounts feature modules.
 * The Phase-0 inline wiring (config/logger/db/queue) now lives in dedicated
 * modules so each concern is isolated and testable.
 *
 * Import order is deliberate:
 * 1. AppConfigModule  — global, validated env; every other module's async
 *    factory injects its typed config.
 * 2. CommonModule     — applies RequestIdMiddleware BEFORE the logger, so the
 *    correlation id exists when nestjs-pino binds it (ADR §9).
 * 3. AppLoggerModule  — request logging (pino-http).
 * 4. DatabaseModule / RedisModule / QueueModule — data + async infrastructure.
 * 5. HealthModule     — liveness/readiness probes.
 * 6. Feature modules  — AuthModule (E1); the rest of the map register here
 *    across Phase 1 (see src/modules/README.md).
 */
import { Module } from '@nestjs/common';

import { CommonModule } from './common/common.module';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AppLoggerModule } from './logger/logger.module';
import { MailModule } from './mail/mail.module';
import { MediaModule } from './media/media.module';
import { AuthModule } from './modules/auth/auth.module';
import { EngagementModule } from './modules/engagement/engagement.module';
import { FeedModule } from './modules/feed/feed.module';
import { PiecesModule } from './modules/pieces/pieces.module';
import { TaxonomyModule } from './modules/taxonomy/taxonomy.module';
import { UsersModule } from './modules/users/users.module';
import { QueueModule } from './queue/queue.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    AppConfigModule,
    CommonModule,
    AppLoggerModule,
    DatabaseModule,
    RedisModule,
    QueueModule,
    MailModule,
    MediaModule,
    HealthModule,
    TaxonomyModule,
    AuthModule,
    UsersModule,
    PiecesModule,
    EngagementModule,
    FeedModule,
  ],
})
export class AppModule {}
