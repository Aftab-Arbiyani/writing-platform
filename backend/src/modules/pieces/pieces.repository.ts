import { Injectable } from '@nestjs/common';
import type { PieceStatus } from '@qalam/shared';
import { DataSource } from 'typeorm';
import type { EntityManager, Repository } from 'typeorm';

import type { CursorPayload } from '../../common/pagination/cursor.util';
import { Piece } from './entities/piece.entity';
import { PieceTag } from './entities/piece-tag.entity';

/** Data access for `pieces` + `piece_tags` (docs 16 §3.3). */
@Injectable()
export class PiecesRepository {
  constructor(private readonly dataSource: DataSource) {}

  private manager(manager?: EntityManager): EntityManager {
    return manager ?? this.dataSource.manager;
  }

  private repo(manager?: EntityManager): Repository<Piece> {
    return this.manager(manager).getRepository(Piece);
  }

  /** Non-deleted piece by id. */
  findById(id: string, manager?: EntityManager): Promise<Piece | null> {
    return this.repo(manager).findOne({ where: { id } });
  }

  /**
   * Slug uniqueness check **including soft-deleted rows** (URLs are permanent —
   * a restored piece reclaims its slug, docs 04 §1.5).
   */
  async slugExists(slug: string, manager?: EntityManager): Promise<boolean> {
    return (await this.repo(manager).count({ where: { slug }, withDeleted: true })) > 0;
  }

  create(data: Partial<Piece>, manager?: EntityManager): Promise<Piece> {
    const repo = this.repo(manager);
    return repo.save(repo.create(data));
  }

  async update(id: string, patch: Partial<Piece>, manager?: EntityManager): Promise<void> {
    // Cast to the update signature's param type: TypeORM's QueryDeepPartialEntity
    // mishandles the `content` jsonb (Record<string, unknown> values).
    await this.repo(manager).update({ id }, patch as Parameters<Repository<Piece>['update']>[1]);
  }

  async softDelete(id: string, manager?: EntityManager): Promise<void> {
    await this.repo(manager).softDelete({ id });
  }

  /**
   * Scheduled pieces whose publish time has arrived — the `scheduled-publish`
   * worker's due query (docs 04 §3.2 `idx_pieces_due`). Ordered oldest-first so a
   * backlog drains in schedule order; non-deleted only.
   */
  findDueScheduled(now: Date, limit: number, manager?: EntityManager): Promise<Piece[]> {
    return this.repo(manager)
      .createQueryBuilder('p')
      .where('p.status = :status', { status: 'scheduled' })
      .andWhere('p.scheduled_at <= :now', { now })
      .andWhere('p.deleted_at IS NULL')
      .orderBy('p.scheduled_at', 'ASC')
      .limit(limit)
      .getMany();
  }

  /**
   * Hard-deletes soft-deleted pieces whose tombstone predates `cutoff` (the
   * maintenance purge). Uses a raw delete with `withDeleted` semantics — the
   * default repository only sees non-deleted rows. Returns the number removed.
   */
  async hardDeleteSoftDeletedBefore(cutoff: Date, manager?: EntityManager): Promise<number> {
    const result = await this.repo(manager)
      .createQueryBuilder()
      .delete()
      .from(Piece)
      .where('deleted_at IS NOT NULL')
      .andWhere('deleted_at < :cutoff', { cutoff })
      .execute();
    return result.affected ?? 0;
  }

  /** Author's pieces, optionally filtered by status, keyset-paginated (over-fetch limit+1). */
  listByAuthor(
    authorId: string,
    options: { status?: PieceStatus; cursor: CursorPayload | null; limit: number },
    manager?: EntityManager,
  ): Promise<Piece[]> {
    const qb = this.repo(manager)
      .createQueryBuilder('p')
      .where('p.author_id = :authorId', { authorId })
      .orderBy('p.created_at', 'DESC')
      .addOrderBy('p.id', 'DESC')
      .limit(options.limit + 1);

    if (options.status !== undefined) {
      qb.andWhere('p.status = :status', { status: options.status });
    }
    if (options.cursor !== null) {
      qb.andWhere('(p.created_at, p.id) < (:k, :cid)', {
        k: options.cursor.k,
        cid: options.cursor.id,
      });
    }
    return qb.getMany();
  }

  getTagIds(pieceId: string, manager?: EntityManager): Promise<string[]> {
    return this.manager(manager)
      .getRepository(PieceTag)
      .find({ where: { pieceId }, select: { tagId: true } })
      .then((rows) => rows.map((r) => r.tagId));
  }

  /** Replaces the piece's tag set (delete-all + insert) inside a transaction. */
  async setTags(pieceId: string, tagIds: string[], manager: EntityManager): Promise<void> {
    const repo = manager.getRepository(PieceTag);
    await repo.delete({ pieceId });
    if (tagIds.length > 0) {
      await repo.save(tagIds.map((tagId) => repo.create({ pieceId, tagId })));
    }
  }
}
