import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { EntityManager, Repository } from 'typeorm';

import type { CursorPayload } from '../../common/pagination/cursor.util';
import { Comment } from './entities/comment.entity';

/** A comment joined with its author (users + profiles) for the thread view. */
export interface CommentRow {
  id: string;
  parentId: string | null;
  depth: number;
  authorId: string;
  body: string;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  username: string | null;
  penName: string | null;
  avatarKey: string | null;
}

/** Data access for `comments` (E7). Replies are self-referenced by `parent_id`. */
@Injectable()
export class CommentsRepository {
  constructor(private readonly dataSource: DataSource) {}

  private manager(manager?: EntityManager): EntityManager {
    return manager ?? this.dataSource.manager;
  }

  private repo(manager?: EntityManager): Repository<Comment> {
    return this.manager(manager).getRepository(Comment);
  }

  create(data: Partial<Comment>, manager?: EntityManager): Promise<Comment> {
    const repo = this.repo(manager);
    return repo.save(repo.create(data));
  }

  /** Non-deleted comment by id. */
  findById(id: string, manager?: EntityManager): Promise<Comment | null> {
    return this.repo(manager).findOne({ where: { id } });
  }

  /** Comment by id **including** soft-deleted rows (to distinguish deleted vs absent). */
  findByIdWithDeleted(id: string, manager?: EntityManager): Promise<Comment | null> {
    return this.repo(manager).findOne({ where: { id }, withDeleted: true });
  }

  async update(id: string, patch: Partial<Comment>, manager?: EntityManager): Promise<void> {
    await this.repo(manager).update({ id }, patch);
  }

  async softDelete(id: string, manager?: EntityManager): Promise<void> {
    await this.repo(manager).softDelete({ id });
  }

  /** Reverses a soft delete (moderator restore, A5 appeals). */
  async restore(id: string, manager?: EntityManager): Promise<void> {
    await this.repo(manager).restore({ id });
  }

  /**
   * Top-level comments on a piece joined with each author (single query — no
   * N+1), newest first, keyset-paginated over `(created_at, id)`. Soft-deleted
   * comments ARE included (they render as tombstones; replies stay visible) —
   * `.withDeleted()` forces inclusion; the service blanks the deleted author.
   */
  listTopLevel(
    pieceId: string,
    cursor: CursorPayload | null,
    limit: number,
    manager?: EntityManager,
  ): Promise<CommentRow[]> {
    return this.threadQuery(manager)
      .where('c.piece_id = :pieceId AND c.parent_id IS NULL', { pieceId })
      .andWhere(cursorPredicate(cursor), cursorParams(cursor))
      .limit(limit + 1)
      .getRawMany<CommentRow>();
  }

  /** Replies to a comment joined with each author, keyset-paginated (deleted included). */
  listReplies(
    parentId: string,
    cursor: CursorPayload | null,
    limit: number,
    manager?: EntityManager,
  ): Promise<CommentRow[]> {
    return this.threadQuery(manager)
      .where('c.parent_id = :parentId', { parentId })
      .andWhere(cursorPredicate(cursor), cursorParams(cursor))
      .limit(limit + 1)
      .getRawMany<CommentRow>();
  }

  private threadQuery(
    manager?: EntityManager,
  ): ReturnType<Repository<Comment>['createQueryBuilder']> {
    return this.repo(manager)
      .createQueryBuilder('c')
      .withDeleted()
      .leftJoin('users', 'u', 'u.id = c.author_id')
      .leftJoin('profiles', 'pr', 'pr.user_id = c.author_id')
      .select('c.id', 'id')
      .addSelect('c.parent_id', 'parentId')
      .addSelect('c.depth', 'depth')
      .addSelect('c.author_id', 'authorId')
      .addSelect('c.body', 'body')
      .addSelect('c.edited_at', 'editedAt')
      .addSelect('c.deleted_at', 'deletedAt')
      .addSelect('c.created_at', 'createdAt')
      .addSelect('c.updated_at', 'updatedAt')
      .addSelect('u.username', 'username')
      .addSelect('pr.pen_name', 'penName')
      .addSelect('pr.avatar_key', 'avatarKey')
      .orderBy('c.created_at', 'DESC')
      .addOrderBy('c.id', 'DESC');
  }

  /**
   * Immediate reply counts for a set of parent comments (one grouped query — no
   * N+1). Deleted replies are counted (they still occupy a node). Returns a map
   * of `parentId → count`.
   */
  async countRepliesByParents(
    parentIds: string[],
    manager?: EntityManager,
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (parentIds.length === 0) {
      return result;
    }
    const rows: Array<{ parentId: string; count: string }> = await this.repo(manager)
      .createQueryBuilder('c')
      .withDeleted()
      .select('c.parent_id', 'parentId')
      .addSelect('COUNT(*)', 'count')
      .where('c.parent_id IN (:...parentIds)', { parentIds })
      .groupBy('c.parent_id')
      .getRawMany();
    for (const row of rows) {
      result.set(row.parentId, Number(row.count));
    }
    return result;
  }
}

/** Keyset predicate over `(created_at, id)` — a no-op when there is no cursor. */
function cursorPredicate(cursor: CursorPayload | null): string {
  return cursor === null ? '1=1' : '(c.created_at, c.id) < (:k, :cid)';
}

function cursorParams(cursor: CursorPayload | null): Record<string, unknown> {
  return cursor === null ? {} : { k: cursor.k, cid: cursor.id };
}
