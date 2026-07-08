import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PiecesModule } from '../pieces/pieces.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsListener } from './analytics.listener';
import { AnalyticsService } from './analytics.service';
import { AnalyticsAggregatorRepository } from './analytics-aggregator.repository';
import { AnalyticsCacheService } from './analytics-cache.service';
import { AnalyticsQueryRepository } from './analytics-query.repository';
import { AnalyticsSnapshot } from './entities/analytics-snapshot.entity';
import { PieceAnalytics } from './entities/piece-analytics.entity';
import { PlatformAnalytics } from './entities/platform-analytics.entity';
import { ReaderAnalytics } from './entities/reader-analytics.entity';
import { ReadEvent } from './entities/read-event.entity';
import { ViewEvent } from './entities/view-event.entity';
import { WriterAnalytics } from './entities/writer-analytics.entity';

/**
 * Analytics & Insights (E10). Event-driven: the listener subscribes to the global
 * `DomainEventBus` and updates aggregate tables (the only analytics writer);
 * business modules just emit. Reads serve aggregates/snapshots (fast). Owns its
 * seven tables (`forFeature`) but queries them + other domains' tables by name via
 * the DataSource (docs 16 §3.1). Imports `PiecesModule` to validate + resolve the
 * author for tracked views/reads. Guards/decorators file-imported (no cycle).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PieceAnalytics,
      WriterAnalytics,
      ReaderAnalytics,
      PlatformAnalytics,
      AnalyticsSnapshot,
      ViewEvent,
      ReadEvent,
    ]),
    PiecesModule,
  ],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsAggregatorRepository,
    AnalyticsQueryRepository,
    AnalyticsCacheService,
    AnalyticsService,
    AnalyticsListener,
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
