import { PolicyResourceType } from '@qalam/shared';
import type { Visibility } from '@qalam/shared';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { PolicyResource, PolicySubject } from '../policy';
import type { PublicationEvent } from './entities/publication-event.entity';
import type { ReviewSession } from './entities/review-session.entity';
import type { StorySnapshot } from './entities/story-snapshot.entity';
import type { PublicationEventDto, ReviewDto, SnapshotDto } from './dto/publishing-response.dto';

/**
 * The story facts every write authorizes against, resolved from
 * `PiecesService.getStoryContext(storyId)` (docs 16 §3.1 — publishing never
 * imports the pieces repository). Shared by all three publishing services.
 */
export interface StoryContext {
  authorId: string;
  visibility: Visibility;
  isPublished: boolean;
}

/** The Policy Engine subject — always derived from the JWT, never the body. */
export function subjectOf(actor: AuthenticatedUser): PolicySubject {
  return { userId: actor.id, role: actor.role };
}

/**
 * Builds the Policy Engine resource for a story-scoped action. The story owner
 * is the piece's real author (from `getStoryContext`), so the engine resolves
 * ownership/story-role against the true owner — never a client-supplied value.
 */
export function buildStoryResource(
  storyId: string,
  ctx: StoryContext,
  type: PolicyResourceType,
): PolicyResource {
  return {
    type,
    id: storyId,
    storyId,
    storyOwnerId: ctx.authorId,
    ownerId: ctx.authorId,
    visibility: ctx.visibility,
    isPublished: ctx.isPublished,
  };
}

export function toReviewDto(session: ReviewSession): ReviewDto {
  return {
    id: session.id,
    storyId: session.storyId,
    requestedById: session.requestedById,
    state: session.state,
    reviewerId: session.reviewerId,
    decision: session.decision,
    notes: session.notes,
    submittedAt: session.submittedAt.toISOString(),
    decidedAt: session.decidedAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

export function toSnapshotDto(snapshot: StorySnapshot): SnapshotDto {
  return {
    id: snapshot.id,
    storyId: snapshot.storyId,
    version: snapshot.version,
    title: snapshot.title,
    content: snapshot.content,
    wordCount: snapshot.wordCount,
    reason: snapshot.reason,
    createdById: snapshot.createdById,
    createdAt: snapshot.createdAt.toISOString(),
  };
}

export function toPublicationEventDto(event: PublicationEvent): PublicationEventDto {
  return {
    id: event.id,
    storyId: event.storyId,
    actorId: event.actorId,
    type: event.type,
    metadata: event.metadata,
    createdAt: event.createdAt.toISOString(),
  };
}
