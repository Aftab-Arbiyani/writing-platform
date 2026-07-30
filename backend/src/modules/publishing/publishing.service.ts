import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  NotificationEntityType,
  NotificationType,
  POLICY_ACTIONS,
  PolicyResourceType,
  SnapshotReason,
  type Visibility,
} from '@qalam/shared';

import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PieceNotFoundException } from '../pieces/exceptions/pieces.exceptions';
import { PiecesService } from '../pieces/pieces.service';
import { PolicyEngineService } from '../policy';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { PieceResponseDto } from '../pieces/dto/piece-response.dto';
import type { PublicationEventDto } from './dto/publishing-response.dto';
import { PUBLISHING_AUDIT_ACTIONS, PUBLISHING_AUDIT_TARGET } from './publishing.constants';
import { PublicationNotApprovedException } from './publishing.exceptions';
import { PublishingRepository } from './publishing.repository';
import { ReviewService } from './review.service';
import { SnapshotService } from './snapshot.service';
import {
  buildStoryResource,
  subjectOf,
  toPublicationEventDto,
  type StoryContext,
} from './publishing.mappers';

/**
 * The editorial publishing layer (AF6) — the review-aware wrapper over the
 * existing piece lifecycle. It authorizes every write through the Policy Engine,
 * enforces the review gate, snapshots content on publish, records an immutable
 * publishing-history event, and then DELEGATES the actual state change to
 * {@link PiecesService} (passing the story's real author as `ownerId`, the same
 * on-behalf pattern moderation uses). It never reimplements the piece lifecycle.
 *
 * Review gate: a story is review-gated ONLY while it has an OPEN (not-approved)
 * review session. With no session, publishing proceeds directly (unchanged
 * behaviour); with an open, non-approved session, publish is blocked
 * (`PUBLICATION_NOT_APPROVED`). Notifications are best-effort.
 */
@Injectable()
export class PublishingService {
  private readonly logger = new Logger(PublishingService.name);

  constructor(
    private readonly pieces: PiecesService,
    private readonly engine: PolicyEngineService,
    private readonly audit: AuditService,
    private readonly reviews: ReviewService,
    private readonly snapshots: SnapshotService,
    private readonly repo: PublishingRepository,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  /** Publishes a story (review gate → snapshot → delegate → history → notify). */
  async publish(storyId: string, actor: AuthenticatedUser): Promise<PieceResponseDto> {
    const ctx = await this.requireContext(storyId);
    await this.engine.assert({
      subject: subjectOf(actor),
      action: POLICY_ACTIONS.PublicationPublish,
      resource: buildStoryResource(storyId, ctx, PolicyResourceType.Publication),
    });

    if (await this.reviews.hasOpenReview(storyId)) {
      throw new PublicationNotApprovedException();
    }

    // Snapshot the about-to-be-published content, then delegate the real state
    // change to the pieces lifecycle (owner = the story's true author).
    await this.snapshots.create(storyId, actor, SnapshotReason.Publish);
    const result = await this.pieces.publish(storyId, ctx.authorId);

    await this.repo.recordEvent({ storyId, actorId: actor.id, type: 'published' });
    await this.reviews.markPublished(storyId);
    await this.writeAudit(actor, PUBLISHING_AUDIT_ACTIONS.Published, storyId, {});
    this.notify(ctx.authorId, actor.id, NotificationType.StoryPublished, storyId);
    return result;
  }

  /** Unpublishes (archives) a published story. */
  async unpublish(storyId: string, actor: AuthenticatedUser): Promise<PieceResponseDto> {
    const ctx = await this.requireContext(storyId);
    await this.engine.assert({
      subject: subjectOf(actor),
      action: POLICY_ACTIONS.PublicationUnpublish,
      resource: buildStoryResource(storyId, ctx, PolicyResourceType.Publication),
    });

    const result = await this.pieces.archive(storyId, ctx.authorId);
    await this.repo.recordEvent({ storyId, actorId: actor.id, type: 'unpublished' });
    await this.writeAudit(actor, PUBLISHING_AUDIT_ACTIONS.Unpublished, storyId, {});
    return result;
  }

  /** Schedules a future publish. */
  async schedule(
    storyId: string,
    actor: AuthenticatedUser,
    scheduledAtIso: string,
  ): Promise<PieceResponseDto> {
    const ctx = await this.requireContext(storyId);
    await this.engine.assert({
      subject: subjectOf(actor),
      action: POLICY_ACTIONS.PublicationSchedule,
      resource: buildStoryResource(storyId, ctx, PolicyResourceType.Publication),
    });

    const result = await this.pieces.schedule(storyId, ctx.authorId, scheduledAtIso);
    await this.repo.recordEvent({
      storyId,
      actorId: actor.id,
      type: 'scheduled',
      metadata: { scheduledAt: scheduledAtIso },
    });
    await this.writeAudit(actor, PUBLISHING_AUDIT_ACTIONS.Scheduled, storyId, {
      scheduledAt: scheduledAtIso,
    });
    return result;
  }

  /** Changes a story's visibility. */
  async changeVisibility(
    storyId: string,
    actor: AuthenticatedUser,
    visibility: Visibility,
  ): Promise<PieceResponseDto> {
    const ctx = await this.requireContext(storyId);
    await this.engine.assert({
      subject: subjectOf(actor),
      action: POLICY_ACTIONS.PublicationChangeVisibility,
      resource: buildStoryResource(storyId, ctx, PolicyResourceType.Publication),
    });

    const result = await this.pieces.update(storyId, ctx.authorId, { visibility });
    await this.repo.recordEvent({
      storyId,
      actorId: actor.id,
      type: 'visibility_changed',
      metadata: { from: ctx.visibility, to: visibility },
    });
    await this.writeAudit(actor, PUBLISHING_AUDIT_ACTIONS.VisibilityChanged, storyId, {
      from: ctx.visibility,
      to: visibility,
    });
    return result;
  }

  /** A story's publishing history, newest first. */
  async history(storyId: string, actor: AuthenticatedUser): Promise<PublicationEventDto[]> {
    const ctx = await this.requireContext(storyId);
    await this.engine.assert({
      subject: subjectOf(actor),
      action: POLICY_ACTIONS.StoryView,
      resource: buildStoryResource(storyId, ctx, PolicyResourceType.Story),
    });
    const events = await this.repo.listEvents(storyId);
    return events.map(toPublicationEventDto);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async requireContext(storyId: string): Promise<StoryContext> {
    const ctx = await this.pieces.getStoryContext(storyId);
    if (ctx === null) {
      throw new PieceNotFoundException();
    }
    return ctx;
  }

  private writeAudit(
    actor: AuthenticatedUser,
    action: string,
    storyId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    return this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action,
      targetType: PUBLISHING_AUDIT_TARGET.Story,
      targetId: storyId,
      metadata,
    });
  }

  /** Best-effort notification — a delivery failure never fails the write. */
  private notify(
    recipientId: string,
    actorId: string,
    type: NotificationType,
    storyId: string,
  ): void {
    if (this.notifications === undefined) {
      return;
    }
    void this.notifications
      .create({
        recipientId,
        actorId,
        type,
        entityType: NotificationEntityType.Story,
        entityId: storyId,
      })
      .catch((error: unknown) => {
        this.logger.warn(`publishing notification failed: ${(error as Error).message}`);
      });
  }
}
