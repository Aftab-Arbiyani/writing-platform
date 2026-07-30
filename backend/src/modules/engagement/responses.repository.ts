import { Injectable } from '@nestjs/common';
import { PieceStatus, Visibility } from '@qalam/shared';
import { DataSource } from 'typeorm';
import type { EntityManager, Repository } from 'typeorm';

import type { CursorPayload } from '../../common/pagination/cursor.util';
import { PieceResponse } from './entities/piece-response.entity';

/** A response joined with its (child) piece + author, for the parent's thread. */
export interface ResponseRow {
  responseId: string;
  respondedAt: Date;
  pieceId: string;
  slug: string | null;
  title: string;
  subtitle: string | null;
  publishedAt: Date | null;
  username: string;
  penName: string | null;
}

/** Data access for `responses` (piece → parent piece links, docs 04 §3.2). */
@Injectable()
export class ResponsesRepository {
  constructor(private readonly dataSource: DataSource) {}

  private manager(manager?: EntityManager): EntityManager {
    return manager ?? this.dataSource.manager;
  }

  private repo(manager?: EntityManager): Repository<PieceResponse> {
    return this.manager(manager).getRepository(PieceResponse);
  }

  async create(pieceId: string, parentPieceId: string, manager?: EntityManager): Promise<void> {
    const repo = this.repo(manager);
    await repo.save(repo.create({ pieceId, parentPieceId }));
  }

  /** The link where this piece is the response child (a piece responds once). */
  findByChild(pieceId: string, manager?: EntityManager): Promise<PieceResponse | null> {
    return this.repo(manager).findOne({ where: { pieceId } });
  }

  /**
   * Responses to a parent piece, joined with each response piece + author,
   * keyset-paginated over `(responses.created_at, id)`. Only responses whose
   * piece is published + publicly visible are listed; private-account authors'
   * responses appear only to the author (docs 13 §4.2 — safe default; the
   * follower-aware refinement is a feeds concern, E6).
   */
  listByParent(
    parentPieceId: string,
    viewerId: string | null,
    cursor: CursorPayload | null,
    limit: number,
    manager?: EntityManager,
  ): Promise<ResponseRow[]> {
    const qb = this.repo(manager)
      .createQueryBuilder('r')
      .innerJoin('pieces', 'p', 'p.id = r.piece_id AND p.deleted_at IS NULL')
      .innerJoin('users', 'u', 'u.id = p.author_id')
      .leftJoin('profiles', 'pr', 'pr.user_id = p.author_id')
      .select('r.id', 'responseId')
      .addSelect('r.created_at', 'respondedAt')
      .addSelect('p.id', 'pieceId')
      .addSelect('p.slug', 'slug')
      .addSelect('p.title', 'title')
      .addSelect('p.subtitle', 'subtitle')
      .addSelect('p.published_at', 'publishedAt')
      .addSelect('u.username', 'username')
      .addSelect('pr.pen_name', 'penName')
      .where('r.parent_piece_id = :parentPieceId', { parentPieceId })
      .andWhere('p.status = :published', { published: PieceStatus.Published })
      .andWhere('p.visibility IN (:...visible)', {
        visible: [Visibility.Public, Visibility.Unlisted],
      })
      .orderBy('r.created_at', 'DESC')
      .addOrderBy('r.id', 'DESC')
      .limit(limit + 1);

    if (viewerId !== null) {
      qb.andWhere('(pr.is_private = false OR pr.is_private IS NULL OR p.author_id = :viewerId)', {
        viewerId,
      });
    } else {
      qb.andWhere('(pr.is_private = false OR pr.is_private IS NULL)');
    }
    if (cursor !== null) {
      qb.andWhere('(r.created_at, r.id) < (:k, :cid)', { k: cursor.k, cid: cursor.id });
    }
    return qb.getRawMany<ResponseRow>();
  }
}
