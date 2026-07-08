import type { FollowStatus, ShareChannel } from '@qalam/shared';

/**
 * Internal domain events (E9). A decoupling seam: feature modules EMIT these
 * after a mutation commits, knowing nothing about who consumes them; the
 * notification engine SUBSCRIBES. The bus is in-process and synchronous-awaited
 * with per-handler error isolation ({@link DomainEventBus}) — no BullMQ worker in
 * Phase 1 (the roadmap's async fan-out is the later swap, mirroring how feeds
 * compute trending live rather than via a queue).
 *
 * Payload types live here (in `common`, not `@qalam/shared`) because they are a
 * backend-internal contract, never a wire shape. Emitters and the notification
 * listener both import from here so neither depends on the other's module.
 */

/** Event name constants — the string key each payload is emitted/handled under. */
export const DomainEventType = {
  UserFollowed: 'user.followed',
  FollowAccepted: 'follow.accepted',
  CommentCreated: 'comment.created',
  ReactionCreated: 'reaction.created',
  PieceResponseCreated: 'piece.response.created',
  PiecePublished: 'piece.published',
  // Analytics (E10) — additive; existing consumers ignore what they don't subscribe to.
  PieceArchived: 'piece.archived',
  PieceViewed: 'piece.viewed',
  ReadCompleted: 'read.completed',
  BookmarkAdded: 'bookmark.added',
  ShareCreated: 'share.created',
} as const;
export type DomainEventType = (typeof DomainEventType)[keyof typeof DomainEventType];

/** Someone followed (public → accepted) or requested to follow (private → pending). */
export interface UserFollowedEvent {
  followId: string;
  followerId: string;
  followeeId: string;
  status: FollowStatus;
}

/** A private account accepted a pending follow request → notify the requester. */
export interface FollowAcceptedEvent {
  followId: string;
  followerId: string;
  followeeId: string;
}

/** A comment (or reply, when `parentId` is set) was posted on a piece. */
export interface CommentCreatedEvent {
  commentId: string;
  pieceId: string;
  pieceAuthorId: string;
  commentAuthorId: string;
  parentId: string | null;
  parentAuthorId: string | null;
  body: string;
}

/** A like or clap landed on a piece. */
export interface ReactionCreatedEvent {
  kind: 'like' | 'clap';
  pieceId: string;
  pieceAuthorId: string;
  actorId: string;
}

/** A new piece was published as a response to another piece. */
export interface PieceResponseCreatedEvent {
  responsePieceId: string;
  parentPieceId: string;
  parentAuthorId: string;
  actorId: string;
}

/** A piece was published — the trigger for extracting @mentions in its content. */
export interface PiecePublishedEvent {
  pieceId: string;
  authorId: string;
}

/** A published piece was archived (writer analytics). */
export interface PieceArchivedEvent {
  pieceId: string;
  authorId: string;
}

/** A piece was viewed (analytics ingest). `viewerKey` de-dupes anon + auth viewers. */
export interface PieceViewedEvent {
  pieceId: string;
  authorId: string;
  viewerId: string | null;
  viewerKey: string;
  isAuthenticated: boolean;
}

/** A read session finished, with reported dwell + scroll completion (analytics). */
export interface ReadCompletedEvent {
  pieceId: string;
  authorId: string;
  readerId: string | null;
  durationSeconds: number;
  completionPct: number;
}

/** A piece was bookmarked (analytics; distinct from ReactionCreated like/clap). */
export interface BookmarkAddedEvent {
  pieceId: string;
  pieceAuthorId: string;
  actorId: string;
}

/** A piece was shared through a channel (analytics share breakdown). */
export interface ShareCreatedEvent {
  pieceId: string;
  pieceAuthorId: string;
  actorId: string | null;
  channel: ShareChannel;
}

/** Maps each event name to its payload type (compile-time safety on emit/on). */
export interface DomainEventMap {
  [DomainEventType.UserFollowed]: UserFollowedEvent;
  [DomainEventType.FollowAccepted]: FollowAcceptedEvent;
  [DomainEventType.CommentCreated]: CommentCreatedEvent;
  [DomainEventType.ReactionCreated]: ReactionCreatedEvent;
  [DomainEventType.PieceResponseCreated]: PieceResponseCreatedEvent;
  [DomainEventType.PiecePublished]: PiecePublishedEvent;
  [DomainEventType.PieceArchived]: PieceArchivedEvent;
  [DomainEventType.PieceViewed]: PieceViewedEvent;
  [DomainEventType.ReadCompleted]: ReadCompletedEvent;
  [DomainEventType.BookmarkAdded]: BookmarkAddedEvent;
  [DomainEventType.ShareCreated]: ShareCreatedEvent;
}
