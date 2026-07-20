import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PiecesModule } from '../pieces/pieces.module';
import { PublicationEvent } from './entities/publication-event.entity';
import { ReviewSession } from './entities/review-session.entity';
import { StorySnapshot } from './entities/story-snapshot.entity';
import { PublishingController } from './publishing.controller';
import { PublishingRepository } from './publishing.repository';
import { PublishingService } from './publishing.service';
import { ReviewService } from './review.service';
import { SnapshotService } from './snapshot.service';

/**
 * Publishing platform (AF6) — the EDITORIAL layer (review workflow, approval,
 * content snapshots, publishing history) on top of the existing piece lifecycle.
 * It REUSES {@link PiecesModule} (`PiecesService`) for the actual publish/
 * schedule/visibility/content state changes and authorizes every write through
 * the Policy Engine (`PolicyEngineService`, `@Global`). Reuses `AuditModule`
 * (audit trail) and `NotificationsModule` (best-effort review/publish
 * notifications). `PolicyModule` and `PermissionsModule` are `@Global`, so they
 * need no explicit import.
 *
 * Additive-only: 3 new tables (`review_sessions`, `story_snapshots`,
 * `publication_events`) + `/stories/:id/*` and `/snapshots/:id` endpoints; the
 * piece lifecycle contract is unchanged. A story with no review session
 * publishes directly (backward compatible).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ReviewSession, StorySnapshot, PublicationEvent]),
    PiecesModule,
    AuditModule,
    NotificationsModule,
  ],
  controllers: [PublishingController],
  providers: [PublishingRepository, PublishingService, ReviewService, SnapshotService],
  exports: [PublishingService],
})
export class PublishingModule {}
