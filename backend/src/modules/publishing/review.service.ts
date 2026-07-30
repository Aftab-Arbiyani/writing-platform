import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  NotificationEntityType,
  NotificationType,
  POLICY_ACTIONS,
  PolicyResourceType,
  ReviewDecision,
  ReviewState,
} from '@qalam/shared';

import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PieceNotFoundException } from '../pieces/exceptions/pieces.exceptions';
import { PiecesService } from '../pieces/pieces.service';
import { PolicyEngineService } from '../policy';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { ReviewDto } from './dto/publishing-response.dto';
import type { ReviewSession } from './entities/review-session.entity';
import { PUBLISHING_AUDIT_ACTIONS, PUBLISHING_AUDIT_TARGET } from './publishing.constants';
import {
  ReviewAlreadyRequestedException,
  ReviewInvalidStateException,
  ReviewNotFoundException,
} from './publishing.exceptions';
import { PublishingRepository } from './publishing.repository';
import {
  buildStoryResource,
  subjectOf,
  toReviewDto,
  type StoryContext,
} from './publishing.mappers';

/** States from which a reviewer decision (approve / request changes) is legal. */
const DECIDABLE_STATES: readonly ReviewState[] = [
  ReviewState.InReview,
  ReviewState.ChangesRequested,
];

/**
 * The editorial review workflow (AF6). A story becomes review-gated when a
 * session is `request()`ed; a reviewer then `approve()`s (unlocking publish) or
 * `requestChanges()` (bouncing back to the author). Every write is authorized by
 * the Policy Engine — no hand-rolled permission checks. Notifications are
 * best-effort (a failed notify never fails the workflow write).
 */
@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(
    private readonly pieces: PiecesService,
    private readonly engine: PolicyEngineService,
    private readonly audit: AuditService,
    private readonly repo: PublishingRepository,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  /** Submits a story for review. At most one OPEN session per story. */
  async request(storyId: string, actor: AuthenticatedUser): Promise<ReviewDto> {
    const ctx = await this.requireContext(storyId);
    await this.engine.assert({
      subject: subjectOf(actor),
      action: POLICY_ACTIONS.ReviewRequest,
      resource: buildStoryResource(storyId, ctx, PolicyResourceType.Review),
    });

    if ((await this.repo.findOpenSession(storyId)) !== null) {
      throw new ReviewAlreadyRequestedException();
    }

    const session = await this.repo.createReviewSession({
      storyId,
      requestedById: actor.id,
      state: ReviewState.InReview,
      reviewerId: null,
      decision: null,
      notes: null,
      submittedAt: new Date(),
      decidedAt: null,
    });

    await this.repo.recordEvent({
      storyId,
      actorId: actor.id,
      type: 'submitted',
      metadata: { reviewId: session.id },
    });
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: PUBLISHING_AUDIT_ACTIONS.ReviewRequested,
      targetType: PUBLISHING_AUDIT_TARGET.Review,
      targetId: storyId,
      metadata: { reviewId: session.id },
    });
    // Notify the story owner a review was requested (self-notify is dropped).
    this.notify(ctx.authorId, actor.id, NotificationType.ReviewRequested, storyId);
    return toReviewDto(session);
  }

  /** Approves the current review session, unlocking publish for the story. */
  async approve(storyId: string, actor: AuthenticatedUser): Promise<ReviewDto> {
    const ctx = await this.requireContext(storyId);
    await this.engine.assert({
      subject: subjectOf(actor),
      action: POLICY_ACTIONS.ReviewApprove,
      resource: buildStoryResource(storyId, ctx, PolicyResourceType.Review),
    });

    const session = this.requireDecidable(await this.repo.findCurrentSession(storyId));
    session.state = ReviewState.Approved;
    session.decision = ReviewDecision.Approve;
    session.reviewerId = actor.id;
    session.notes = null;
    session.decidedAt = new Date();
    const saved = await this.repo.saveReviewSession(session);

    await this.repo.recordEvent({
      storyId,
      actorId: actor.id,
      type: 'review_approved',
      metadata: { reviewId: saved.id },
    });
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: PUBLISHING_AUDIT_ACTIONS.ReviewApproved,
      targetType: PUBLISHING_AUDIT_TARGET.Review,
      targetId: storyId,
      metadata: { reviewId: saved.id },
    });
    this.notify(saved.requestedById, actor.id, NotificationType.ReviewCompleted, storyId);
    return toReviewDto(saved);
  }

  /** Bounces the story back to the author with change requests. */
  async requestChanges(
    storyId: string,
    actor: AuthenticatedUser,
    notes?: string,
  ): Promise<ReviewDto> {
    const ctx = await this.requireContext(storyId);
    await this.engine.assert({
      subject: subjectOf(actor),
      action: POLICY_ACTIONS.ReviewApprove,
      resource: buildStoryResource(storyId, ctx, PolicyResourceType.Review),
    });

    const session = this.requireDecidable(await this.repo.findCurrentSession(storyId));
    session.state = ReviewState.ChangesRequested;
    session.decision = ReviewDecision.RequestChanges;
    session.reviewerId = actor.id;
    session.notes = notes ?? null;
    session.decidedAt = new Date();
    const saved = await this.repo.saveReviewSession(session);

    await this.repo.recordEvent({
      storyId,
      actorId: actor.id,
      type: 'changes_requested',
      metadata: { reviewId: saved.id },
    });
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: PUBLISHING_AUDIT_ACTIONS.ChangesRequested,
      targetType: PUBLISHING_AUDIT_TARGET.Review,
      targetId: storyId,
      metadata: { reviewId: saved.id },
    });
    this.notify(saved.requestedById, actor.id, NotificationType.ReviewCompleted, storyId);
    return toReviewDto(saved);
  }

  /** The current review session for a story, or null. */
  async get(storyId: string): Promise<ReviewDto | null> {
    const session = await this.repo.findCurrentSession(storyId);
    return session === null ? null : toReviewDto(session);
  }

  // ── Collaborators for PublishingService ─────────────────────────────────────

  /** Whether the story is review-gated and not yet approved (blocks publish). */
  async hasOpenReview(storyId: string): Promise<boolean> {
    return (await this.repo.findOpenSession(storyId)) !== null;
  }

  /** Closes an approved session once the story publishes (in_review→...→published). */
  async markPublished(storyId: string): Promise<void> {
    const session = await this.repo.findCurrentSession(storyId);
    if (session !== null && session.state === ReviewState.Approved) {
      session.state = ReviewState.Published;
      await this.repo.saveReviewSession(session);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async requireContext(storyId: string): Promise<StoryContext> {
    const ctx = await this.pieces.getStoryContext(storyId);
    if (ctx === null) {
      throw new PieceNotFoundException();
    }
    return ctx;
  }

  private requireDecidable(session: ReviewSession | null): ReviewSession {
    if (session === null) {
      throw new ReviewNotFoundException();
    }
    if (!DECIDABLE_STATES.includes(session.state)) {
      throw new ReviewInvalidStateException();
    }
    return session;
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
        entityType: NotificationEntityType.Review,
        entityId: storyId,
      })
      .catch((error: unknown) => {
        this.logger.warn(`review notification failed: ${(error as Error).message}`);
      });
  }
}
