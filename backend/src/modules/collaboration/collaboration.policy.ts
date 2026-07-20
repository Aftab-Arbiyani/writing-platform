import { PolicyResourceType } from '@qalam/shared';
import type { Visibility } from '@qalam/shared';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { PolicyResource, PolicySubject } from '../policy';

/**
 * Helpers that translate collaboration facts into Policy Engine inputs. The
 * engine is the single source of truth for authorization; these functions only
 * shape the question — they NEVER decide it. Story facts (`storyOwnerId`,
 * `visibility`, `isPublished`) come exclusively from `PiecesService.getStoryContext`
 * (a trusted service that read the DB), never from the client.
 */

/** The story facts the engine needs, as returned by `PiecesService.getStoryContext`. */
export interface StoryFacts {
  authorId: string;
  visibility: Visibility;
  isPublished: boolean;
}

/** The principal, resolved from the JWT (never the request body). */
export function subjectOf(user: AuthenticatedUser): PolicySubject {
  return { userId: user.id, role: user.role };
}

/** A story-level resource (membership/invite/comment-create/suggest/view actions). */
export function storyResource(
  storyId: string,
  facts: StoryFacts,
  extra?: { targetUserId?: string | null },
): PolicyResource {
  return {
    type: PolicyResourceType.Story,
    id: storyId,
    storyId,
    ownerId: facts.authorId,
    storyOwnerId: facts.authorId,
    visibility: facts.visibility,
    isPublished: facts.isPublished,
    targetUserId: extra?.targetUserId ?? null,
  };
}

/** A comment resource — `ownerId` is the comment author (enables engine self-service). */
export function commentResource(
  commentId: string,
  storyId: string,
  facts: StoryFacts,
  commentAuthorId: string,
): PolicyResource {
  return {
    type: PolicyResourceType.Comment,
    id: commentId,
    storyId,
    ownerId: commentAuthorId,
    storyOwnerId: facts.authorId,
    visibility: facts.visibility,
    isPublished: facts.isPublished,
  };
}

/** A suggestion resource — `ownerId` is the suggestion author (enables self-service). */
export function suggestionResource(
  suggestionId: string,
  storyId: string,
  facts: StoryFacts,
  suggestionAuthorId: string,
): PolicyResource {
  return {
    type: PolicyResourceType.Suggestion,
    id: suggestionId,
    storyId,
    ownerId: suggestionAuthorId,
    storyOwnerId: facts.authorId,
    visibility: facts.visibility,
    isPublished: facts.isPublished,
  };
}
