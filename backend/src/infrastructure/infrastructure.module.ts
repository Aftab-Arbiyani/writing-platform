import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';

import { JOB_ENQUEUER } from '../common/queue/job-enqueuer.port';
import { QUEUE_NAMES } from '../common/queue/queue.constants';
import { infrastructureConfig } from '../config/infrastructure.config';
import { AnalyticsModule } from '../modules/analytics/analytics.module';
import { AuthModule } from '../modules/auth/auth.module';
import { FeedModule } from '../modules/feed/feed.module';
import { MonetizationModule } from '../modules/monetization/monetization.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { PiecesModule } from '../modules/pieces/pieces.module';
import { SearchModule } from '../modules/search/search.module';
import { CacheService } from './cache/cache.service';
import { CacheWarmerService } from './cache/cache-warmer.service';
import { EventBridgeService } from './events/event-bridge.service';
import { MaintenanceService } from './maintenance/maintenance.service';
import { AdminCacheController } from './monitoring/admin-cache.controller';
import { AdminQueueController } from './monitoring/admin-queue.controller';
import { MetricsController } from './monitoring/metrics.controller';
import { MetricsInterceptor } from './monitoring/metrics.interceptor';
import { MetricsService } from './monitoring/metrics.service';
import { QueueMonitorService } from './monitoring/queue-monitor.service';
import { SystemController } from './monitoring/system.controller';
import { VersionController } from './monitoring/version.controller';
import { DeadLetterService } from './queue/dead-letter.service';
import { QueueProducer } from './queue/queue-producer.service';
import { QueueRegistry } from './queue/queue-registry.service';
import { SchedulerService } from './scheduler/scheduler.service';
import { AnalyticsRollupProcessor } from './worker/analytics-rollup.processor';
import { CacheProcessor } from './worker/cache.processor';
import { MaintenanceProcessor } from './worker/maintenance.processor';
import { MediaProcessingProcessor } from './worker/media-processing.processor';
import { MonetizationProcessor } from './worker/monetization.processor';
import { NotificationsProcessor } from './worker/notifications.processor';
import { ScheduledPublishProcessor } from './worker/scheduled-publish.processor';
import { TrendingScoreProcessor } from './worker/trending-score.processor';
import {
  AnalyticsHourlySnapshotHandler,
  AnalyticsNightlyRollupHandler,
} from './worker/handlers/analytics-rollup.handlers';
import {
  CacheInvalidateHandler,
  CacheOptimizeHandler,
  CacheRefreshHandler,
  CacheWarmHandler,
} from './worker/handlers/cache.handlers';
import {
  DailyCleanupHandler,
  WeeklyDbMaintenanceHandler,
} from './worker/handlers/maintenance.handlers';
import { MediaOptimizeHandler } from './worker/handlers/media-processing.handlers';
import {
  MonetizationLifecycleSweepHandler,
  MonetizationWebhookHandler,
} from './worker/handlers/monetization.handlers';
import { BroadcastHandler } from './worker/handlers/notifications.handlers';
import { PublishDueHandler, PublishOneHandler } from './worker/handlers/scheduled-publish.handlers';
import { TrendingRecomputeHandler } from './worker/handlers/trending-score.handlers';

/**
 * The asynchronous-processing backbone (Epic 11). Composes the five concern
 * areas — Queue (registry/producer/DLQ), Worker (processors), Scheduler (cron),
 * Cache (read-through + warming), and Monitoring (admin APIs) — plus the event
 * bridge that turns domain events into jobs.
 *
 * `@Global` so the {@link JOB_ENQUEUER} producer port, the {@link QueueRegistry},
 * and the {@link CacheService} are injectable everywhere without re-importing:
 * business modules publish jobs through the port (as an OPTIONAL dependency), and
 * the health module probes the registry. The dependency arrow is one-way —
 * infrastructure imports business modules to reach their exported services;
 * business modules never import infrastructure.
 *
 * Workers run in-process (docs 02 §3, extractable later). Set `WORKERS_ENABLED=false`
 * to run an API-only node whose jobs are processed by a separate worker node —
 * the processors are simply not registered, everything else still works.
 */
const WORKER_PROCESSORS = [
  ScheduledPublishProcessor,
  NotificationsProcessor,
  AnalyticsRollupProcessor,
  TrendingScoreProcessor,
  MediaProcessingProcessor,
  CacheProcessor,
  MaintenanceProcessor,
  MonetizationProcessor,
];

// The typed job handlers each processor dispatches to (the "job classes").
const JOB_HANDLERS = [
  PublishDueHandler,
  PublishOneHandler,
  BroadcastHandler,
  MediaOptimizeHandler,
  AnalyticsHourlySnapshotHandler,
  AnalyticsNightlyRollupHandler,
  TrendingRecomputeHandler,
  CacheWarmHandler,
  CacheRefreshHandler,
  CacheInvalidateHandler,
  CacheOptimizeHandler,
  DailyCleanupHandler,
  WeeklyDbMaintenanceHandler,
  MonetizationWebhookHandler,
  MonetizationLifecycleSweepHandler,
];

// Processors + their handlers are only registered on worker nodes; an API-only
// node (WORKERS_ENABLED=false) still enqueues, monitors, and serves admin APIs.
const workers =
  process.env.WORKERS_ENABLED === 'false' ? [] : [...WORKER_PROCESSORS, ...JOB_HANDLERS];

@Global()
@Module({
  imports: [
    ConfigModule.forFeature(infrastructureConfig),
    // Register all named queues on the shared BullMQ connection (QueueModule's
    // forRootAsync, Redis DB 1). Names come from the single catalogue in `common`.
    BullModule.registerQueue(...QUEUE_NAMES.map((name) => ({ name }))),
    // Business modules whose exported services the workers/warmer/maintenance call.
    // MediaModule + CommonModule + RedisModule + PermissionsModule are @Global.
    PiecesModule,
    NotificationsModule,
    AnalyticsModule,
    FeedModule,
    SearchModule,
    AuthModule,
    MonetizationModule,
  ],
  controllers: [
    AdminQueueController,
    AdminCacheController,
    MetricsController,
    VersionController,
    SystemController,
  ],
  providers: [
    QueueRegistry,
    QueueProducer,
    { provide: JOB_ENQUEUER, useExisting: QueueProducer },
    DeadLetterService,
    CacheService,
    CacheWarmerService,
    QueueMonitorService,
    MetricsService,
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
    MaintenanceService,
    SchedulerService,
    EventBridgeService,
    ...workers,
  ],
  exports: [JOB_ENQUEUER, QueueRegistry, CacheService, MetricsService, QueueMonitorService],
})
export class InfrastructureModule {}
