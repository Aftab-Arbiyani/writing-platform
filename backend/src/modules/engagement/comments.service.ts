import { Injectable } from '@nestjs/common';
import { MAX_COMMENT_DEPTH, ROLE_RANK, type Role } from '@qalam/shared';

import { TransactionRunner } from '../../common/database/transaction-runner';
import { decodeCursor } from '../../common/pagination/cursor.util';
import { buildCursorPage } from '../../common/pagination/pagination.helper';
import type { CursorPage } from '../../common/types/paginated-result';
import { PiecesService } from '../pieces/pieces.service';
import { ProfileService } from '../users/profile.service';
import { UsersService } from '../users/users.service';
import type { CreateCommentDto } from './dto/create-comment.dto';
import type { CommentResponseDto } from './dto/comment-response.dto';
import type { UpdateCommentDto } from './dto/update-comment.dto';
import type { Comment } from './entities/comment.entity';
import type { CommentRow } from './comments.repository';
import { CommentsRepository } from './comments.repository';
import {
  CommentDeletedException,
  CommentDepthExceededException,
  CommentForbiddenException,
  CommentNotFoundException,
} from './exceptions/engagement.exceptions';
import { PieceStatsRepository } from './piece-stats.repository';

const DELETED_BODY = 'This comment has been deleted.';

/**
 * Comments + threaded replies (E7 — net-new; docs 04 records the table). Only
 * authenticated users comment (global JwtAuthGuard). A reply is a comment with a
 * `parentId`; nesting is capped at `MAX_COMMENT_DEPTH`. Edits are owner-only and
 * stamp `edited_at`; deletes are soft and allowed for the owner OR a moderator+,
 * leaving a tombstone so replies stay visible. `piece_stats.comments_count` is
 * bumped transactionally on create (docs 04 §7).
 */
@Injectable()
export class CommentsService {
  constructor(
    private readonly comments: CommentsRepository,
    private readonly pieceStats: PieceStatsRepository,
    private readonly pieces: PiecesService,
    private readonly users: UsersService,
    private readonly profiles: ProfileService,
    private readonly transactions: TransactionRunner,
  ) {}

  /** Top-level comment on a piece (piece must be published + visible). */
  async create(
    pieceId: string,
    authorId: string,
    dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    await this.pieces.getEngageablePiece(pieceId, authorId);
    const comment = await this.transactions.run(async (manager) => {
      const created = await this.comments.create(
        { pieceId, authorId, parentId: null, depth: 1, body: dto.body },
        manager,
      );
      await this.pieceStats.increment(pieceId, { comments: 1 }, manager);
      return created;
    });
    return this.resolveOwnDto(comment, 0);
  }

  /** Reply to a comment; rejects nesting beyond `MAX_COMMENT_DEPTH`. */
  async reply(
    parentCommentId: string,
    authorId: string,
    dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    const parent = await this.comments.findByIdWithDeleted(parentCommentId);
    if (parent === null) {
      throw new CommentNotFoundException();
    }
    if (parent.deletedAt !== null) {
      throw new CommentDeletedException();
    }
    if (parent.depth + 1 > MAX_COMMENT_DEPTH) {
      throw new CommentDepthExceededException();
    }
    // The parent's piece must still be published + visible to the replier.
    await this.pieces.getEngageablePiece(parent.pieceId, authorId);

    const comment = await this.transactions.run(async (manager) => {
      const created = await this.comments.create(
        {
          pieceId: parent.pieceId,
          authorId,
          parentId: parent.id,
          depth: parent.depth + 1,
          body: dto.body,
        },
        manager,
      );
      await this.pieceStats.increment(parent.pieceId, { comments: 1 }, manager);
      return created;
    });
    return this.resolveOwnDto(comment, 0);
  }

  /** Edit a comment (owner only); stamps `edited_at`. */
  async update(
    commentId: string,
    userId: string,
    dto: UpdateCommentDto,
  ): Promise<CommentResponseDto> {
    const comment = await this.comments.findById(commentId);
    if (comment === null) {
      throw new CommentNotFoundException();
    }
    if (comment.authorId !== userId) {
      throw new CommentForbiddenException('edit');
    }
    const editedAt = new Date();
    await this.comments.update(commentId, { body: dto.body, editedAt });
    const replyCount = (await this.comments.countRepliesByParents([commentId])).get(commentId) ?? 0;
    comment.body = dto.body;
    comment.editedAt = editedAt;
    return this.resolveOwnDto(comment, replyCount);
  }

  /**
   * Soft-delete a comment. Allowed for the owner OR a moderator+ (content
   * moderation). The node persists as a tombstone so replies stay visible; the
   * comment count is NOT decremented (the node still displays, docs decision).
   */
  async delete(commentId: string, userId: string, role: Role): Promise<void> {
    const comment = await this.comments.findById(commentId);
    if (comment === null) {
      throw new CommentNotFoundException();
    }
    const canModerate = ROLE_RANK[role] >= ROLE_RANK.moderator;
    if (comment.authorId !== userId && !canModerate) {
      throw new CommentForbiddenException('delete');
    }
    await this.comments.softDelete(commentId);
  }

  /** Top-level comments on a piece, cursor-paginated with immediate reply counts. */
  async listForPiece(
    pieceId: string,
    viewerId: string | null,
    rawCursor: string | undefined,
    limit: number,
  ): Promise<CursorPage<CommentResponseDto>> {
    await this.pieces.getEngageablePiece(pieceId, viewerId);
    const rows = await this.comments.listTopLevel(pieceId, decodeCursor(rawCursor), limit);
    return this.buildPage(rows, limit);
  }

  /** Replies to a comment, cursor-paginated (each reply's own reply count too). */
  async listReplies(
    parentCommentId: string,
    viewerId: string | null,
    rawCursor: string | undefined,
    limit: number,
  ): Promise<CursorPage<CommentResponseDto>> {
    const parent = await this.comments.findByIdWithDeleted(parentCommentId);
    if (parent === null) {
      throw new CommentNotFoundException();
    }
    await this.pieces.getEngageablePiece(parent.pieceId, viewerId);
    const rows = await this.comments.listReplies(parentCommentId, decodeCursor(rawCursor), limit);
    return this.buildPage(rows, limit);
  }

  // ── helpers ────────────────────────────────────────────────────────────

  private async buildPage(
    rows: CommentRow[],
    limit: number,
  ): Promise<CursorPage<CommentResponseDto>> {
    const page = buildCursorPage(rows, limit, (r) => ({
      k: new Date(r.createdAt).toISOString(),
      id: r.id,
    }));
    const replyCounts = await this.comments.countRepliesByParents(page.items.map((r) => r.id));
    return {
      items: page.items.map((row) => toDto(row, replyCounts.get(row.id) ?? 0)),
      meta: page.meta,
    };
  }

  /** Builds the DTO for a single created/edited comment, resolving its author. */
  private async resolveOwnDto(comment: Comment, replyCount: number): Promise<CommentResponseDto> {
    const [user, profile] = await Promise.all([
      this.users.findById(comment.authorId),
      this.profiles.getOrCreateByUserId(comment.authorId),
    ]);
    return toDto(
      {
        id: comment.id,
        parentId: comment.parentId,
        depth: comment.depth,
        authorId: comment.authorId,
        body: comment.body,
        editedAt: comment.editedAt,
        deletedAt: comment.deletedAt,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        username: user?.username ?? null,
        penName: profile.penName,
        avatarKey: profile.avatarKey,
      },
      replyCount,
    );
  }
}

/** Maps a joined comment row to the wire DTO, blanking deleted comments. */
function toDto(row: CommentRow, replyCount: number): CommentResponseDto {
  const isDeleted = row.deletedAt !== null;
  return {
    id: row.id,
    parentId: row.parentId,
    depth: row.depth,
    author: isDeleted
      ? null
      : { username: row.username ?? '', penName: row.penName, avatarKey: row.avatarKey },
    body: isDeleted ? DELETED_BODY : row.body,
    isDeleted,
    replyCount,
    editedAt: row.editedAt?.toISOString() ?? null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}
