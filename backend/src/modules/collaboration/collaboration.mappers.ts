import { StoryRole } from '@qalam/shared';
import type { PolicyDecision } from '@qalam/shared';

import type {
  ActivityDto,
  CapabilityDto,
  CommentDto,
  InvitationDto,
  MemberDto,
  SuggestionDto,
} from './dto/collaboration-response.dto';
import type { CollaborationActivity } from './entities/collaboration-activity.entity';
import type { CollaborationComment } from './entities/collaboration-comment.entity';
import type { StoryInvitation } from './entities/story-invitation.entity';
import type { StoryMembership } from './entities/story-membership.entity';
import type { StorySuggestion } from './entities/story-suggestion.entity';

/** Entity → response DTO mappers (AF6). Controllers never return entities raw. */

export function toMemberDto(m: StoryMembership): MemberDto {
  return {
    userId: m.userId,
    role: m.role,
    invitedById: m.invitedById,
    joinedAt: m.createdAt.toISOString(),
  };
}

/** The synthetic owner roster entry (the owner has no membership row). */
export function ownerMemberDto(ownerId: string): MemberDto {
  return { userId: ownerId, role: StoryRole.Owner, invitedById: null, joinedAt: null };
}

export function toInvitationDto(i: StoryInvitation): InvitationDto {
  return {
    id: i.id,
    storyId: i.storyId,
    inviterId: i.inviterId,
    inviteeId: i.inviteeId,
    role: i.role,
    status: i.status,
    expiresAt: i.expiresAt.toISOString(),
    respondedAt: i.respondedAt?.toISOString() ?? null,
    createdAt: i.createdAt.toISOString(),
  };
}

export function toCommentDto(c: CollaborationComment): CommentDto {
  return {
    id: c.id,
    storyId: c.storyId,
    authorId: c.authorId,
    parentId: c.parentId,
    kind: c.kind,
    anchor:
      c.anchor === null ? null : { from: c.anchor.from, to: c.anchor.to, quote: c.anchor.quote },
    body: c.body,
    status: c.status,
    resolvedById: c.resolvedById,
    mentions: c.mentions,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export function toSuggestionDto(s: StorySuggestion): SuggestionDto {
  return {
    id: s.id,
    storyId: s.storyId,
    authorId: s.authorId,
    anchor: { from: s.anchor.from, to: s.anchor.to },
    originalText: s.originalText,
    suggestedText: s.suggestedText,
    status: s.status,
    resolvedById: s.resolvedById,
    resolvedAt: s.resolvedAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  };
}

export function toActivityDto(a: CollaborationActivity): ActivityDto {
  return {
    id: a.id,
    storyId: a.storyId,
    actorId: a.actorId,
    type: a.type,
    metadata: a.metadata,
    createdAt: a.createdAt.toISOString(),
  };
}

/** Flattens the engine's `explain` map into the wire capability list. */
export function toCapabilityDtos(decisions: Record<string, PolicyDecision>): CapabilityDto[] {
  return Object.entries(decisions).map(([action, decision]) => ({
    action,
    effect: decision.effect,
    allowed: decision.allowed,
    reason: decision.reason,
    obligations: [...decision.obligations],
  }));
}
