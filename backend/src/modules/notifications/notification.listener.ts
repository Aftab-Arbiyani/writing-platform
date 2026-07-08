import { Injectable, type OnModuleInit } from '@nestjs/common';
import {
  FollowStatus,
  MENTION_REGEX,
  NotificationEntityType,
  NotificationType,
} from '@qalam/shared';

import { DomainEventBus } from '../../common/events/domain-event-bus';
import {
  DomainEventType,
  type CommentCreatedEvent,
  type FollowAcceptedEvent,
  type PiecePublishedEvent,
  type PieceResponseCreatedEvent,
  type ReactionCreatedEvent,
  type UserFollowedEvent,
} from '../../common/events/domain-events';
import { ProfileService } from '../users/profile.service';
import { UsersService } from '../users/users.service';
import { PiecesService } from '../pieces/pieces.service';
import { NotificationsService } from './notifications.service';

interface ActorSummary {
  username: string;
  penName: string | null;
  avatarKey: string | null;
}
interface PieceSummary {
  slug: string | null;
  title: string;
}

const EXCERPT_MAX = 140;

/**
 * The subscription seam (E9). Translates decoupled domain events into
 * `NotificationsService.create()` calls — the only place events become
 * notifications, so feature modules stay ignorant of notifications entirely
 * (they just emit). Handlers hydrate the denormalized render payload via existing
 * exported services (docs 16 §3.1) and derive mentions from comment bodies and
 * piece content. Every handler is best-effort: the bus isolates thrown errors so
 * a notification failure never affects the action that emitted the event.
 */
@Injectable()
export class NotificationEventListener implements OnModuleInit {
  constructor(
    private readonly bus: DomainEventBus,
    private readonly notifications: NotificationsService,
    private readonly users: UsersService,
    private readonly profiles: ProfileService,
    private readonly pieces: PiecesService,
  ) {}

  onModuleInit(): void {
    this.bus.on(DomainEventType.UserFollowed, (e) => this.onUserFollowed(e));
    this.bus.on(DomainEventType.FollowAccepted, (e) => this.onFollowAccepted(e));
    this.bus.on(DomainEventType.CommentCreated, (e) => this.onCommentCreated(e));
    this.bus.on(DomainEventType.ReactionCreated, (e) => this.onReactionCreated(e));
    this.bus.on(DomainEventType.PieceResponseCreated, (e) => this.onPieceResponse(e));
    this.bus.on(DomainEventType.PiecePublished, (e) => this.onPiecePublished(e));
  }

  // ── Follows ────────────────────────────────────────────────────────────────

  private async onUserFollowed(e: UserFollowedEvent): Promise<void> {
    const actor = await this.hydrateActor(e.followerId);
    await this.notifications.create({
      recipientId: e.followeeId,
      actorId: e.followerId,
      type:
        e.status === FollowStatus.Accepted
          ? NotificationType.Follow
          : NotificationType.FollowRequest,
      entityType: NotificationEntityType.User,
      entityId: e.followerId,
      data: { actor },
      dedupe: true,
    });
  }

  private async onFollowAccepted(e: FollowAcceptedEvent): Promise<void> {
    const actor = await this.hydrateActor(e.followeeId);
    await this.notifications.create({
      recipientId: e.followerId,
      actorId: e.followeeId,
      type: NotificationType.FollowAccepted,
      entityType: NotificationEntityType.User,
      entityId: e.followeeId,
      data: { actor },
      dedupe: true,
    });
  }

  // ── Reactions ────────────────────────────────────────────────────────────

  private async onReactionCreated(e: ReactionCreatedEvent): Promise<void> {
    const [actor, piece] = await Promise.all([
      this.hydrateActor(e.actorId),
      this.hydratePiece(e.pieceId),
    ]);
    await this.notifications.create({
      recipientId: e.pieceAuthorId,
      actorId: e.actorId,
      type: e.kind === 'clap' ? NotificationType.Clap : NotificationType.Like,
      entityType: NotificationEntityType.Piece,
      entityId: e.pieceId,
      data: { actor, piece },
      dedupe: true,
    });
  }

  // ── Responses ────────────────────────────────────────────────────────────

  private async onPieceResponse(e: PieceResponseCreatedEvent): Promise<void> {
    const [actor, piece] = await Promise.all([
      this.hydrateActor(e.actorId),
      this.hydratePiece(e.parentPieceId),
    ]);
    await this.notifications.create({
      recipientId: e.parentAuthorId,
      actorId: e.actorId,
      type: NotificationType.Response,
      entityType: NotificationEntityType.Piece,
      entityId: e.parentPieceId,
      data: { actor, piece, responsePieceId: e.responsePieceId },
    });
  }

  // ── Comments (+ mentions in the body) ───────────────────────────────────────

  private async onCommentCreated(e: CommentCreatedEvent): Promise<void> {
    const [actor, piece] = await Promise.all([
      this.hydrateActor(e.commentAuthorId),
      this.hydratePiece(e.pieceId),
    ]);
    const excerpt = e.body.slice(0, EXCERPT_MAX);
    const base = {
      actorId: e.commentAuthorId,
      entityType: NotificationEntityType.Comment,
      entityId: e.commentId,
      data: { actor, piece, comment: { id: e.commentId, excerpt } },
    };

    // Primary recipient: the parent comment's author (reply) or the piece author (comment).
    const isReply = e.parentId !== null && e.parentAuthorId !== null;
    const primaryRecipient = isReply ? e.parentAuthorId : e.pieceAuthorId;
    if (primaryRecipient !== null) {
      await this.notifications.create({
        ...base,
        recipientId: primaryRecipient,
        type: isReply ? NotificationType.CommentReply : NotificationType.Comment,
      });
    }

    // Mentions in the body — skip the actor and whoever already got the primary above.
    const mentionedIds = await this.resolveUsernames(this.extractMentionUsernames(e.body));
    for (const recipientId of mentionedIds) {
      if (recipientId === e.commentAuthorId || recipientId === primaryRecipient) {
        continue;
      }
      await this.notifications.create({
        ...base,
        recipientId,
        type: NotificationType.Mention,
        dedupe: true,
      });
    }
  }

  // ── Piece mentions (on publish) ─────────────────────────────────────────────

  private async onPiecePublished(e: PiecePublishedEvent): Promise<void> {
    let content: unknown;
    let piece: PieceSummary | null;
    try {
      const full = await this.pieces.getById(e.pieceId, null);
      content = full.content;
      piece = { slug: full.slug, title: full.title };
    } catch {
      // Not publicly readable (e.g. private) — no mention notifications.
      return;
    }
    const actor = await this.hydrateActor(e.authorId);
    const mentionedIds = this.extractMentionUserIds(content);
    for (const recipientId of mentionedIds) {
      if (recipientId === e.authorId) {
        continue;
      }
      if ((await this.users.findById(recipientId)) === null) {
        continue;
      }
      await this.notifications.create({
        recipientId,
        actorId: e.authorId,
        type: NotificationType.Mention,
        entityType: NotificationEntityType.Piece,
        entityId: e.pieceId,
        data: { actor, piece },
        dedupe: true,
      });
    }
  }

  // ── Hydration + parsing helpers ────────────────────────────────────────────

  private async hydrateActor(actorId: string): Promise<ActorSummary | null> {
    const user = await this.users.findById(actorId);
    if (user === null) {
      return null;
    }
    const profile = await this.profiles.getOrCreateByUserId(actorId);
    return { username: user.username, penName: profile.penName, avatarKey: profile.avatarKey };
  }

  private async hydratePiece(pieceId: string): Promise<PieceSummary | null> {
    try {
      const piece = await this.pieces.getById(pieceId, null);
      return { slug: piece.slug, title: piece.title };
    } catch {
      return null;
    }
  }

  private extractMentionUsernames(body: string): string[] {
    const names = new Set<string>();
    for (const match of body.matchAll(MENTION_REGEX)) {
      if (match[1] !== undefined) {
        names.add(match[1].toLowerCase());
      }
    }
    return [...names];
  }

  private async resolveUsernames(usernames: string[]): Promise<string[]> {
    const ids = new Set<string>();
    for (const username of usernames) {
      const user = await this.users.findByUsername(username);
      if (user !== null) {
        ids.add(user.id);
      }
    }
    return [...ids];
  }

  private extractMentionUserIds(doc: unknown): string[] {
    const ids = new Set<string>();
    const walk = (node: unknown): void => {
      if (node === null || typeof node !== 'object') {
        return;
      }
      const n = node as Record<string, unknown>;
      if (n.type === 'mention') {
        const attrs = n.attrs as Record<string, unknown> | undefined;
        if (attrs !== undefined && typeof attrs.userId === 'string') {
          ids.add(attrs.userId);
        }
      }
      if (Array.isArray(n.content)) {
        for (const child of n.content) {
          walk(child);
        }
      }
    };
    walk(doc);
    return [...ids];
  }
}
