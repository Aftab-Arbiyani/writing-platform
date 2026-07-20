import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  CollaborationActivity as ActivityType,
  CommentKind,
  CommentStatus,
  NotificationEntityType,
  NotificationType,
  POLICY_ACTIONS,
} from '@qalam/shared';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AuditService } from '../audit/audit.service';
import { PieceNotFoundException } from '../pieces/exceptions/pieces.exceptions';
import { PiecesService } from '../pieces/pieces.service';
import { PolicyEngineService } from '../policy';
import { decodeCursor } from '../../common/pagination/cursor.util';
import { buildCursorPage } from '../../common/pagination/pagination.helper';
import type { CursorPage } from '../../common/types/paginated-result';
import { ActivityService } from './activity.service';
import {
  COLLABORATION_NOTIFIER,
  type CollaborationNotification,
  type CollaborationNotifier,
} from './collaboration-notifier.port';
import {
  COLLABORATION_AUDIT_ACTIONS,
  COLLABORATION_AUDIT_TARGET,
  COLLABORATION_PAGE_SIZE_DEFAULT,
} from './collaboration.constants';
import {
  CollabCommentNotFoundException,
  CollabCommentResolvedException,
} from './collaboration.exceptions';
import { toCommentDto } from './collaboration.mappers';
import { commentResource, storyResource, subjectOf, type StoryFacts } from './collaboration.policy';
import { CollaborationRepository } from './collaboration.repository';
import type {
  CommentListQueryDto,
  CreateCommentDto,
  CreateReplyDto,
} from './dto/collaboration-request.dto';
import type { CommentDto, CommentThreadDto } from './dto/collaboration-response.dto';
import { CollaborationComment } from './entities/collaboration-comment.entity';

/** Matches an @mention that carries a user uuid (the editor resolves names → ids client-side). */
const MENTION_UUID_RE = /@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;

/**
 * Collaboration comments + threads (AF6). Creating/replying goes through
 * `engine.assert(StoryComment)`; resolving/deleting go through `CommentResolve` /
 * `CommentDelete` — where the engine's self-service rule lets a comment's own
 * author act on it regardless of story role (the resource carries `ownerId` =
 * comment author). Comment + activity commit together; mention/owner
 * notifications and audit are best-effort after commit.
 */
@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);

  constructor(
    private readonly repo: CollaborationRepository,
    private readonly pieces: PiecesService,
    private readonly engine: PolicyEngineService,
    private readonly audit: AuditService,
    private readonly activity: ActivityService,
    @Optional()
    @Inject(COLLABORATION_NOTIFIER)
    private readonly notifier?: CollaborationNotifier,
  ) {}

  async create(
    storyId: string,
    user: AuthenticatedUser,
    dto: CreateCommentDto,
  ): Promise<CommentDto> {
    const facts = await this.loadFacts(storyId);
    await this.engine.assert({
      subject: subjectOf(user),
      action: POLICY_ACTIONS.StoryComment,
      resource: storyResource(storyId, facts),
    });

    const mentions = parseMentions(dto.body, dto.mentions);
    const comment = await this.insertComment(storyId, user.id, {
      storyId,
      authorId: user.id,
      parentId: null,
      kind: dto.kind ?? CommentKind.General,
      anchor: dto.anchor
        ? { from: dto.anchor.from, to: dto.anchor.to, quote: dto.anchor.quote }
        : null,
      body: dto.body,
      status: CommentStatus.Open,
      mentions,
    });

    await this.notifyComment(comment, facts, mentions, user);
    await this.safeAudit(user, COLLABORATION_AUDIT_ACTIONS.CommentCreate, comment.id, { storyId });
    return toCommentDto(comment);
  }

  async reply(parentId: string, user: AuthenticatedUser, dto: CreateReplyDto): Promise<CommentDto> {
    const parent = await this.repo.findCommentById(parentId);
    if (parent === null) {
      throw new CollabCommentNotFoundException();
    }
    if (parent.status === CommentStatus.Resolved) {
      throw new CollabCommentResolvedException();
    }
    const facts = await this.loadFacts(parent.storyId);
    await this.engine.assert({
      subject: subjectOf(user),
      action: POLICY_ACTIONS.StoryComment,
      resource: storyResource(parent.storyId, facts),
    });

    const mentions = parseMentions(dto.body, dto.mentions);
    const comment = await this.insertComment(parent.storyId, user.id, {
      storyId: parent.storyId,
      authorId: user.id,
      parentId: parent.id,
      kind: CommentKind.General,
      anchor: null,
      body: dto.body,
      status: CommentStatus.Open,
      mentions,
    });

    await this.notifyComment(comment, facts, mentions, user, parent.authorId);
    await this.safeAudit(user, COLLABORATION_AUDIT_ACTIONS.CommentCreate, comment.id, {
      storyId: parent.storyId,
      parentId: parent.id,
    });
    return toCommentDto(comment);
  }

  async resolve(commentId: string, user: AuthenticatedUser): Promise<CommentDto> {
    const comment = await this.repo.findCommentById(commentId);
    if (comment === null) {
      throw new CollabCommentNotFoundException();
    }
    const facts = await this.loadFacts(comment.storyId);
    await this.engine.assert({
      subject: subjectOf(user),
      action: POLICY_ACTIONS.CommentResolve,
      resource: commentResource(comment.id, comment.storyId, facts, comment.authorId),
    });

    if (comment.status === CommentStatus.Resolved) {
      throw new CollabCommentResolvedException();
    }
    comment.status = CommentStatus.Resolved;
    comment.resolvedById = user.id;

    const saved = await this.repo.withTransaction(async (manager) => {
      const result = await this.repo.saveComment(comment, manager);
      await this.activity.record(
        comment.storyId,
        user.id,
        ActivityType.CommentResolved,
        { commentId: comment.id },
        manager,
      );
      return result;
    });

    await this.safeAudit(user, COLLABORATION_AUDIT_ACTIONS.CommentResolve, comment.id, {
      storyId: comment.storyId,
    });
    return toCommentDto(saved);
  }

  async delete(commentId: string, user: AuthenticatedUser): Promise<void> {
    const comment = await this.repo.findCommentById(commentId);
    if (comment === null) {
      throw new CollabCommentNotFoundException();
    }
    const facts = await this.loadFacts(comment.storyId);
    await this.engine.assert({
      subject: subjectOf(user),
      action: POLICY_ACTIONS.CommentDelete,
      resource: commentResource(comment.id, comment.storyId, facts, comment.authorId),
    });

    await this.repo.softDeleteComment(comment.id);
    await this.safeAudit(user, COLLABORATION_AUDIT_ACTIONS.CommentDelete, comment.id, {
      storyId: comment.storyId,
    });
  }

  async listForStory(
    storyId: string,
    actor: AuthenticatedUser,
    query: CommentListQueryDto,
  ): Promise<CursorPage<CommentDto>> {
    const facts = await this.loadFacts(storyId);
    await this.engine.assert({
      subject: subjectOf(actor),
      action: POLICY_ACTIONS.StoryView,
      resource: storyResource(storyId, facts),
    });
    const limit = query.limit ?? COLLABORATION_PAGE_SIZE_DEFAULT;
    const rows = await this.repo.listRootComments(storyId, {
      status: query.status,
      cursor: decodeCursor(query.cursor),
      limit,
    });
    const page = buildCursorPage(rows, limit, (c) => ({
      k: c.createdAt.toISOString(),
      id: c.id,
    }));
    return { items: page.items.map(toCommentDto), meta: page.meta };
  }

  /** A root comment plus its replies (chronological). */
  async getThread(commentId: string): Promise<CommentThreadDto> {
    const root = await this.repo.findCommentById(commentId);
    if (root === null || root.parentId !== null) {
      throw new CollabCommentNotFoundException();
    }
    const replies = await this.repo.listReplies(root.id);
    return { comment: toCommentDto(root), replies: replies.map(toCommentDto) };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private insertComment(
    storyId: string,
    actorId: string,
    data: Partial<CollaborationComment>,
  ): Promise<CollaborationComment> {
    return this.repo.withTransaction(async (manager) => {
      const created = await this.repo.createComment(data, manager);
      await this.activity.record(
        storyId,
        actorId,
        ActivityType.CommentAdded,
        { commentId: created.id, parentId: data.parentId ?? null },
        manager,
      );
      return created;
    });
  }

  /**
   * Fan out comment notifications (all best-effort): each @mentioned user gets a
   * `CommentMention`; the story owner (and, for a reply, the parent author) get a
   * `CollabComment`. Self and duplicate recipients are dropped.
   */
  private async notifyComment(
    comment: CollaborationComment,
    facts: StoryFacts,
    mentions: string[],
    actor: AuthenticatedUser,
    parentAuthorId?: string,
  ): Promise<void> {
    const mentioned = new Set(mentions);
    for (const recipientId of mentioned) {
      if (recipientId === actor.id) {
        continue;
      }
      await this.safeNotify({
        recipientId,
        actorId: actor.id,
        type: NotificationType.CommentMention,
        entityType: NotificationEntityType.Comment,
        entityId: comment.id,
        data: { storyId: comment.storyId },
      });
    }

    const followers = new Set<string>([facts.authorId]);
    if (parentAuthorId !== undefined) {
      followers.add(parentAuthorId);
    }
    for (const recipientId of followers) {
      if (recipientId === actor.id || mentioned.has(recipientId)) {
        continue;
      }
      await this.safeNotify({
        recipientId,
        actorId: actor.id,
        type: NotificationType.CollabComment,
        entityType: NotificationEntityType.Comment,
        entityId: comment.id,
        data: { storyId: comment.storyId },
      });
    }
  }

  private async loadFacts(storyId: string): Promise<StoryFacts> {
    const facts = await this.pieces.getStoryContext(storyId);
    if (facts === null) {
      throw new PieceNotFoundException();
    }
    return facts;
  }

  private async safeNotify(input: CollaborationNotification): Promise<void> {
    if (this.notifier === undefined) {
      return;
    }
    try {
      await this.notifier.notify(input);
    } catch (error) {
      this.logger.warn(`notification failed: ${(error as Error).message}`);
    }
  }

  private async safeAudit(
    actor: AuthenticatedUser,
    action: string,
    targetId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.audit.record({
        actorId: actor.id,
        actorRole: actor.role,
        action,
        targetType: COLLABORATION_AUDIT_TARGET.Comment,
        targetId,
        metadata,
      });
    } catch (error) {
      this.logger.warn(`audit failed for ${action}: ${(error as Error).message}`);
    }
  }
}

/** Unions client-supplied mention ids with any @uuid tokens found in the body; deduped. */
function parseMentions(body: string, explicit?: string[]): string[] {
  const ids = new Set<string>(explicit ?? []);
  for (const match of body.matchAll(MENTION_UUID_RE)) {
    const id = match[1];
    if (id !== undefined) {
      ids.add(id.toLowerCase());
    }
  }
  return [...ids];
}
