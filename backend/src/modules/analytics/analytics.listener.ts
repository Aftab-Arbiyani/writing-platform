import { Injectable, type OnModuleInit } from '@nestjs/common';
import {
  FollowStatus,
  READ_MIN_COMPLETION_PCT,
  READ_MIN_DWELL_SECONDS,
  ShareChannel,
} from '@qalam/shared';

import { DomainEventBus } from '../../common/events/domain-event-bus';
import {
  DomainEventType,
  type BookmarkAddedEvent,
  type CommentCreatedEvent,
  type FollowAcceptedEvent,
  type PieceArchivedEvent,
  type PiecePublishedEvent,
  type PieceResponseCreatedEvent,
  type PieceViewedEvent,
  type ReactionCreatedEvent,
  type ReadCompletedEvent,
  type ShareCreatedEvent,
  type UserFollowedEvent,
} from '../../common/events/domain-events';
import { AnalyticsAggregatorRepository } from './analytics-aggregator.repository';
import { AnalyticsCacheService } from './analytics-cache.service';

/**
 * The analytics ingestion seam (E10). Subscribes to domain events and updates the
 * aggregate tables — the ONLY writer of analytics data (business modules just
 * emit). Every handler is best-effort (the bus isolates errors) and does only
 * O(1) counter upserts. Aggregates, not raw events, back the public APIs.
 */
@Injectable()
export class AnalyticsListener implements OnModuleInit {
  constructor(
    private readonly bus: DomainEventBus,
    private readonly aggregator: AnalyticsAggregatorRepository,
    private readonly cache: AnalyticsCacheService,
  ) {}

  onModuleInit(): void {
    this.bus.on(DomainEventType.PiecePublished, (e) => this.onPiecePublished(e));
    this.bus.on(DomainEventType.PieceArchived, (e) => this.onPieceArchived(e));
    this.bus.on(DomainEventType.PieceViewed, (e) => this.onPieceViewed(e));
    this.bus.on(DomainEventType.ReadCompleted, (e) => this.onReadCompleted(e));
    this.bus.on(DomainEventType.CommentCreated, (e) => this.onCommentCreated(e));
    this.bus.on(DomainEventType.ReactionCreated, (e) => this.onReactionCreated(e));
    this.bus.on(DomainEventType.BookmarkAdded, (e) => this.onBookmarkAdded(e));
    this.bus.on(DomainEventType.PieceResponseCreated, (e) => this.onResponseCreated(e));
    this.bus.on(DomainEventType.UserFollowed, (e) => this.onUserFollowed(e));
    this.bus.on(DomainEventType.FollowAccepted, (e) => this.onFollowAccepted(e));
    this.bus.on(DomainEventType.ShareCreated, (e) => this.onShareCreated(e));
  }

  private async onPiecePublished(e: PiecePublishedEvent): Promise<void> {
    await this.aggregator.incrementPiece(e.pieceId, e.authorId, {}, new Date());
    await this.aggregator.incrementWriter(e.authorId, { piecesPublished: 1 });
    await this.aggregator.incrementPlatform({ publishedPieces: 1 });
  }

  private async onPieceArchived(e: PieceArchivedEvent): Promise<void> {
    await this.aggregator.incrementWriter(e.authorId, { piecesArchived: 1 });
    await this.aggregator.incrementPlatform({ archivedPieces: 1 });
  }

  private async onPieceViewed(e: PieceViewedEvent): Promise<void> {
    // Cooldown gate: refresh-spam within the window doesn't re-count.
    if (!(await this.cache.claimView(e.pieceId, e.viewerKey))) {
      return;
    }
    const isUnique = await this.aggregator.recordUniqueView(
      e.pieceId,
      e.viewerKey,
      e.viewerId,
      e.isAuthenticated,
    );
    const u = isUnique ? 1 : 0;
    await this.aggregator.incrementPiece(e.pieceId, e.authorId, { views: 1, uniqueViews: u });
    await this.aggregator.incrementWriter(e.authorId, { views: 1, uniqueViews: u });
    await this.aggregator.incrementPlatform({ views: 1, uniqueViews: u });
  }

  private async onReadCompleted(e: ReadCompletedEvent): Promise<void> {
    const completed =
      e.completionPct >= READ_MIN_COMPLETION_PCT && e.durationSeconds >= READ_MIN_DWELL_SECONDS
        ? 1
        : 0;
    // Determine "first read of this piece" BEFORE recording this session's event
    // (otherwise the just-inserted row would make every read look non-first).
    const firstRead =
      e.readerId !== null ? await this.aggregator.isFirstRead(e.readerId, e.pieceId) : false;
    await this.aggregator.insertReadEvent(
      e.pieceId,
      e.readerId,
      e.durationSeconds,
      e.completionPct,
    );
    await this.aggregator.incrementPiece(e.pieceId, e.authorId, {
      reads: 1,
      totalReadSeconds: e.durationSeconds,
      completedReads: completed,
    });
    await this.aggregator.incrementWriter(e.authorId, {
      reads: 1,
      totalReadSeconds: e.durationSeconds,
      completedReads: completed,
    });
    await this.aggregator.incrementPlatform({ reads: 1, completedReads: completed });

    if (e.readerId !== null) {
      await this.aggregator.upsertReader(
        e.readerId,
        {
          piecesRead: firstRead ? 1 : 0,
          reads: 1,
          totalReadSeconds: e.durationSeconds,
          completedReads: completed,
        },
        new Date().toISOString().slice(0, 10),
      );
    }
  }

  private async onCommentCreated(_e: CommentCreatedEvent): Promise<void> {
    await this.aggregator.incrementPlatform({ comments: 1 });
  }

  private async onReactionCreated(e: ReactionCreatedEvent): Promise<void> {
    if (e.kind === 'clap') {
      await this.aggregator.incrementPlatform({ claps: 1 });
    }
  }

  private async onBookmarkAdded(_e: BookmarkAddedEvent): Promise<void> {
    await this.aggregator.incrementPlatform({ bookmarks: 1 });
  }

  private async onResponseCreated(_e: PieceResponseCreatedEvent): Promise<void> {
    await this.aggregator.incrementPlatform({ responses: 1 });
  }

  /** A follower is gained on an immediate (public) accept... */
  private async onUserFollowed(e: UserFollowedEvent): Promise<void> {
    if (e.status === FollowStatus.Accepted) {
      await this.aggregator.incrementWriter(e.followeeId, { followersGained: 1 });
      await this.aggregator.incrementPlatform({ follows: 1 });
    }
  }

  /** ...or when a private account later approves the request (the accepter gains one). */
  private async onFollowAccepted(e: FollowAcceptedEvent): Promise<void> {
    await this.aggregator.incrementWriter(e.followeeId, { followersGained: 1 });
    await this.aggregator.incrementPlatform({ follows: 1 });
  }

  private async onShareCreated(e: ShareCreatedEvent): Promise<void> {
    await this.aggregator.incrementPiece(e.pieceId, e.pieceAuthorId, {
      sharesInternal: e.channel === ShareChannel.Internal ? 1 : 0,
      sharesExternal: e.channel === ShareChannel.External ? 1 : 0,
      sharesCopyLink: e.channel === ShareChannel.CopyLink ? 1 : 0,
    });
    await this.aggregator.incrementPlatform({ shares: 1 });
  }
}
