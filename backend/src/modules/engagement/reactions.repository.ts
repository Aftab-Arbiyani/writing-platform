import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

import type { CursorPayload } from '../../common/pagination/cursor.util';
import { Bookmark } from './entities/bookmark.entity';
import { Clap } from './entities/clap.entity';
import { Like } from './entities/like.entity';

/** A `/me/bookmarks` row (bookmark joined with its piece). */
export interface BookmarkRow {
  bookmarkId: string;
  createdAt: Date;
  pieceId: string;
  slug: string | null;
  title: string;
}

/**
 * Data access for the three piece-reaction tables (`likes`, `claps`,
 * `bookmarks`) — all keyed `(user_id, piece_id)`, docs 04 §3.4. Likes/bookmarks
 * are append-only toggles; claps upsert a running count.
 */
@Injectable()
export class ReactionsRepository {
  constructor(private readonly dataSource: DataSource) {}

  private manager(manager?: EntityManager): EntityManager {
    return manager ?? this.dataSource.manager;
  }

  private likeRepo(manager?: EntityManager): Repository<Like> {
    return this.manager(manager).getRepository(Like);
  }

  private bookmarkRepo(manager?: EntityManager): Repository<Bookmark> {
    return this.manager(manager).getRepository(Bookmark);
  }

  private clapRepo(manager?: EntityManager): Repository<Clap> {
    return this.manager(manager).getRepository(Clap);
  }

  // ── likes ────────────────────────────────────────────────────────────────

  hasLiked(userId: string, pieceId: string, manager?: EntityManager): Promise<boolean> {
    return this.likeRepo(manager)
      .count({ where: { userId, pieceId } })
      .then((n) => n > 0);
  }

  async insertLike(userId: string, pieceId: string, manager?: EntityManager): Promise<void> {
    const repo = this.likeRepo(manager);
    await repo.save(repo.create({ userId, pieceId }));
  }

  /** Deletes the like if present; returns whether a row was actually removed. */
  async deleteLike(userId: string, pieceId: string, manager?: EntityManager): Promise<boolean> {
    const result = await this.likeRepo(manager).delete({ userId, pieceId });
    return (result.affected ?? 0) > 0;
  }

  // ── claps ────────────────────────────────────────────────────────────────

  getClapCount(userId: string, pieceId: string, manager?: EntityManager): Promise<number> {
    return this.clapRepo(manager)
      .findOne({ where: { userId, pieceId }, select: { count: true } })
      .then((row) => row?.count ?? 0);
  }

  /**
   * Race-safe clap accumulation (docs 04 §3.4). Inserts a row at `LEAST(add, 50)`
   * or, on conflict, sets `count = LEAST(existing + add, 50)`. Returns the new
   * total for this user+piece so the service can derive the applied delta.
   */
  async upsertClap(
    userId: string,
    pieceId: string,
    add: number,
    manager?: EntityManager,
  ): Promise<number> {
    const rows: Array<{ count: number }> = await this.manager(manager).query(
      `INSERT INTO claps (id, user_id, piece_id, count)
       VALUES ($1, $2, $3, LEAST($4, 50))
       ON CONFLICT (user_id, piece_id)
       DO UPDATE SET count = LEAST(claps.count + EXCLUDED.count, 50), updated_at = now()
       RETURNING count`,
      [uuidv7(), userId, pieceId, add],
    );
    return Number(rows[0]?.count ?? 0);
  }

  /** Removes the viewer's clap row entirely; returns whether a row existed. */
  async deleteClap(userId: string, pieceId: string, manager?: EntityManager): Promise<boolean> {
    const result = await this.clapRepo(manager).delete({ userId, pieceId });
    return (result.affected ?? 0) > 0;
  }

  // ── bookmarks ──────────────────────────────────────────────────────────────

  hasBookmarked(userId: string, pieceId: string, manager?: EntityManager): Promise<boolean> {
    return this.bookmarkRepo(manager)
      .count({ where: { userId, pieceId } })
      .then((n) => n > 0);
  }

  async insertBookmark(userId: string, pieceId: string, manager?: EntityManager): Promise<void> {
    const repo = this.bookmarkRepo(manager);
    await repo.save(repo.create({ userId, pieceId }));
  }

  async deleteBookmark(userId: string, pieceId: string, manager?: EntityManager): Promise<boolean> {
    const result = await this.bookmarkRepo(manager).delete({ userId, pieceId });
    return (result.affected ?? 0) > 0;
  }

  /**
   * The owner's bookmarks joined with their pieces, keyset-paginated over
   * `(bookmarks.created_at, bookmarks.id)`. Soft-deleted pieces are excluded.
   */
  listBookmarks(
    userId: string,
    cursor: CursorPayload | null,
    limit: number,
    manager?: EntityManager,
  ): Promise<BookmarkRow[]> {
    const qb = this.bookmarkRepo(manager)
      .createQueryBuilder('b')
      .innerJoin('pieces', 'p', 'p.id = b.piece_id AND p.deleted_at IS NULL')
      .select('b.id', 'bookmarkId')
      .addSelect('b.created_at', 'createdAt')
      .addSelect('p.id', 'pieceId')
      .addSelect('p.slug', 'slug')
      .addSelect('p.title', 'title')
      .where('b.user_id = :userId', { userId })
      .orderBy('b.created_at', 'DESC')
      .addOrderBy('b.id', 'DESC')
      .limit(limit + 1);

    if (cursor !== null) {
      qb.andWhere('(b.created_at, b.id) < (:k, :cid)', { k: cursor.k, cid: cursor.id });
    }
    return qb.getRawMany<BookmarkRow>();
  }
}
