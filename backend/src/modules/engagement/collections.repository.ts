import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { EntityManager, Repository } from 'typeorm';

import type { CursorPayload } from '../../common/pagination/cursor.util';
import { Collection } from './entities/collection.entity';
import { CollectionPiece } from './entities/collection-piece.entity';

/** A piece inside a collection joined with the piece (for the contents view). */
export interface CollectionPieceRow {
  membershipId: string;
  createdAt: Date;
  pieceId: string;
  slug: string | null;
  title: string;
  position: number;
  note: string | null;
}

/** Data access for `collections` + `collection_pieces` (docs 04 §3.5). */
@Injectable()
export class CollectionsRepository {
  constructor(private readonly dataSource: DataSource) {}

  private manager(manager?: EntityManager): EntityManager {
    return manager ?? this.dataSource.manager;
  }

  private repo(manager?: EntityManager): Repository<Collection> {
    return this.manager(manager).getRepository(Collection);
  }

  private memberRepo(manager?: EntityManager): Repository<CollectionPiece> {
    return this.manager(manager).getRepository(CollectionPiece);
  }

  // ── collections ────────────────────────────────────────────────────────────

  create(data: Partial<Collection>, manager?: EntityManager): Promise<Collection> {
    const repo = this.repo(manager);
    return repo.save(repo.create(data));
  }

  findById(id: string, manager?: EntityManager): Promise<Collection | null> {
    return this.repo(manager).findOne({ where: { id } });
  }

  findByOwnerAndSlug(
    ownerId: string,
    slug: string,
    manager?: EntityManager,
  ): Promise<Collection | null> {
    return this.repo(manager).findOne({ where: { ownerId, slug } });
  }

  findDefault(ownerId: string, manager?: EntityManager): Promise<Collection | null> {
    return this.repo(manager).findOne({ where: { ownerId, isDefault: true } });
  }

  async update(id: string, patch: Partial<Collection>, manager?: EntityManager): Promise<void> {
    await this.repo(manager).update({ id }, patch);
  }

  async softDelete(id: string, manager?: EntityManager): Promise<void> {
    await this.repo(manager).softDelete({ id });
  }

  /** Owner's collections, newest first, keyset-paginated over `(created_at, id)`. */
  listByOwner(
    ownerId: string,
    cursor: CursorPayload | null,
    limit: number,
    manager?: EntityManager,
  ): Promise<Collection[]> {
    const qb = this.repo(manager)
      .createQueryBuilder('c')
      .where('c.owner_id = :ownerId AND c.deleted_at IS NULL', { ownerId })
      .orderBy('c.created_at', 'DESC')
      .addOrderBy('c.id', 'DESC')
      .limit(limit + 1);
    if (cursor !== null) {
      qb.andWhere('(c.created_at, c.id) < (:k, :cid)', { k: cursor.k, cid: cursor.id });
    }
    return qb.getMany();
  }

  async incrementPiecesCount(id: string, delta: number, manager?: EntityManager): Promise<void> {
    await this.manager(manager).query(
      `UPDATE collections SET pieces_count = pieces_count + $1, updated_at = now() WHERE id = $2`,
      [delta, id],
    );
  }

  // ── collection_pieces ────────────────────────────────────────────────────

  findMembership(
    collectionId: string,
    pieceId: string,
    manager?: EntityManager,
  ): Promise<CollectionPiece | null> {
    return this.memberRepo(manager).findOne({ where: { collectionId, pieceId } });
  }

  async addPiece(
    data: Partial<CollectionPiece>,
    manager?: EntityManager,
  ): Promise<CollectionPiece> {
    const repo = this.memberRepo(manager);
    return repo.save(repo.create(data));
  }

  async removePiece(
    collectionId: string,
    pieceId: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    const result = await this.memberRepo(manager).delete({ collectionId, pieceId });
    return (result.affected ?? 0) > 0;
  }

  /** Next append position (max + 1) for a collection; 0 when empty. */
  async nextPosition(collectionId: string, manager?: EntityManager): Promise<number> {
    const row: { max: number | null } | undefined = await this.memberRepo(manager)
      .createQueryBuilder('cp')
      .select('MAX(cp.position)', 'max')
      .where('cp.collection_id = :collectionId', { collectionId })
      .getRawOne();
    return (row?.max ?? -1) + 1;
  }

  /**
   * A collection's pieces joined with the piece, keyset-paginated over the
   * membership's `(created_at, id)`. Soft-deleted pieces are excluded.
   */
  listPieces(
    collectionId: string,
    cursor: CursorPayload | null,
    limit: number,
    manager?: EntityManager,
  ): Promise<CollectionPieceRow[]> {
    const qb = this.memberRepo(manager)
      .createQueryBuilder('cp')
      .innerJoin('pieces', 'p', 'p.id = cp.piece_id AND p.deleted_at IS NULL')
      .select('cp.id', 'membershipId')
      .addSelect('cp.created_at', 'createdAt')
      .addSelect('cp.position', 'position')
      .addSelect('cp.note', 'note')
      .addSelect('p.id', 'pieceId')
      .addSelect('p.slug', 'slug')
      .addSelect('p.title', 'title')
      .where('cp.collection_id = :collectionId', { collectionId })
      .orderBy('cp.created_at', 'DESC')
      .addOrderBy('cp.id', 'DESC')
      .limit(limit + 1);
    if (cursor !== null) {
      qb.andWhere('(cp.created_at, cp.id) < (:k, :cid)', { k: cursor.k, cid: cursor.id });
    }
    return qb.getRawMany<CollectionPieceRow>();
  }
}
