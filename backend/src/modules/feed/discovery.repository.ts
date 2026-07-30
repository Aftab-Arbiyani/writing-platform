import { Injectable } from '@nestjs/common';
import { PieceStatus, Visibility } from '@qalam/shared';
import { DataSource } from 'typeorm';
import type { SelectQueryBuilder } from 'typeorm';

import type { CursorPayload } from '../../common/pagination/cursor.util';

/** A writer row for discovery lists (denormalized `profiles` counters). */
export interface WriterCardRow {
  userId: string;
  username: string;
  penName: string | null;
  avatarKey: string | null;
  bio: string | null;
  followersCount: number;
  piecesCount: number;
  createdAt: Date;
}

export interface TrendingTagRow {
  slug: string;
  name: string;
  pieceCount: number;
}
export interface TrendingGenreRow {
  slug: string;
  name: string;
  pieceCount: number;
}
export interface TrendingLanguageRow {
  code: string;
  nativeName: string;
  direction: string;
  pieceCount: number;
}

const WRITER_COLUMNS: string[] = [
  'u.id AS "userId"',
  'u.username AS "username"',
  'u.created_at AS "createdAt"',
  'pr.pen_name AS "penName"',
  'pr.avatar_key AS "avatarKey"',
  'pr.bio AS "bio"',
  'pr.followers_count AS "followersCount"',
  'pr.pieces_count AS "piecesCount"',
];

/**
 * Read-only discovery queries over existing tables (no new entities). Private
 * accounts are excluded everywhere (docs 13 §4.2 — never surfaced in discovery).
 * Writer lists read denormalized `profiles` counters (no `COUNT(*)`); trending
 * taxonomy uses windowed aggregates cached in Redis by the service.
 */
@Injectable()
export class DiscoveryRepository {
  constructor(private readonly dataSource: DataSource) {}

  private writerQuery(): SelectQueryBuilder<Record<string, unknown>> {
    return this.dataSource
      .createQueryBuilder()
      .select(WRITER_COLUMNS)
      .from('profiles', 'pr')
      .innerJoin('users', 'u', 'u.id = pr.user_id')
      .where('pr.is_private = false')
      .andWhere('pr.pieces_count > 0'); // only writers who have published
  }

  /** Most-followed public writers, keyset over (followers_count, user id) DESC. */
  popularWriters(cursor: CursorPayload | null, limit: number): Promise<WriterCardRow[]> {
    const qb = this.writerQuery()
      .orderBy('pr.followers_count', 'DESC')
      .addOrderBy('u.id', 'DESC')
      .limit(limit + 1);
    if (cursor !== null) {
      qb.andWhere('(pr.followers_count, u.id) < (:k::int, :cid::uuid)', {
        k: cursor.k,
        cid: cursor.id,
      });
    }
    return qb.getRawMany<WriterCardRow>();
  }

  /** Newest public writers who have published, keyset over (created_at, id) DESC. */
  newWriters(cursor: CursorPayload | null, limit: number): Promise<WriterCardRow[]> {
    const qb = this.writerQuery()
      .orderBy('u.created_at', 'DESC')
      .addOrderBy('u.id', 'DESC')
      .limit(limit + 1);
    if (cursor !== null) {
      qb.andWhere('(u.created_at, u.id) < (:k::timestamptz, :cid::uuid)', {
        k: cursor.k,
        cid: cursor.id,
      });
    }
    return qb.getRawMany<WriterCardRow>();
  }

  /**
   * Featured writers — derived heuristic pending editorial curation (E10 adds the
   * `featured_writers` table; the endpoint contract stays identical). Ranked by
   * recent engagement on their public pieces (claps + weighted comments/responses)
   * within the window. Returns the full top-N pool; the service caches + paginates
   * it as a snapshot.
   */
  featuredWriters(lookbackDays: number, poolSize: number): Promise<WriterCardRow[]> {
    return this.dataSource
      .createQueryBuilder()
      .select(WRITER_COLUMNS)
      .addSelect(
        `SUM(COALESCE(ps.claps_count,0) + 2*COALESCE(ps.comments_count,0) + 3*COALESCE(ps.responses_count,0))`,
        'score',
      )
      .from('pieces', 'p')
      .innerJoin('users', 'u', 'u.id = p.author_id')
      .innerJoin('profiles', 'pr', 'pr.user_id = u.id AND pr.is_private = false')
      .leftJoin('piece_stats', 'ps', 'ps.piece_id = p.id')
      .where('p.status = :published', { published: PieceStatus.Published })
      .andWhere('p.deleted_at IS NULL')
      .andWhere('p.visibility = :public', { public: Visibility.Public })
      .andWhere(`p.published_at > now() - (:lookbackDays * interval '1 day')`, { lookbackDays })
      .groupBy('u.id')
      .addGroupBy('pr.id')
      .orderBy('score', 'DESC')
      .addOrderBy('u.id', 'DESC')
      .limit(poolSize)
      .getRawMany<WriterCardRow>();
  }

  /** Tags on the most public pieces published within the window. */
  trendingTags(lookbackDays: number, limit: number): Promise<TrendingTagRow[]> {
    return this.dataSource
      .createQueryBuilder()
      .select('t.slug', 'slug')
      .addSelect('t.name', 'name')
      .addSelect('COUNT(*)::int', 'pieceCount')
      .from('piece_tags', 'pt')
      .innerJoin('tags', 't', 't.id = pt.tag_id')
      .innerJoin(
        'pieces',
        'p',
        `p.id = pt.piece_id AND p.status = :published AND p.visibility = :public
         AND p.deleted_at IS NULL AND p.published_at > now() - (:lookbackDays * interval '1 day')`,
        { published: PieceStatus.Published, public: Visibility.Public, lookbackDays },
      )
      .groupBy('t.id')
      .orderBy('"pieceCount"', 'DESC')
      .addOrderBy('t.slug', 'ASC')
      .limit(limit)
      .getRawMany<TrendingTagRow>();
  }

  /** Genres with the most public pieces published within the window. */
  trendingGenres(lookbackDays: number, limit: number): Promise<TrendingGenreRow[]> {
    return this.dataSource
      .createQueryBuilder()
      .select('g.slug', 'slug')
      .addSelect('g.name', 'name')
      .addSelect('COUNT(*)::int', 'pieceCount')
      .from('pieces', 'p')
      .innerJoin('genres', 'g', 'g.id = p.genre_id')
      .where('p.status = :published', { published: PieceStatus.Published })
      .andWhere('p.visibility = :public', { public: Visibility.Public })
      .andWhere('p.deleted_at IS NULL')
      .andWhere(`p.published_at > now() - (:lookbackDays * interval '1 day')`, { lookbackDays })
      .groupBy('g.id')
      .orderBy('"pieceCount"', 'DESC')
      .addOrderBy('g.slug', 'ASC')
      .limit(limit)
      .getRawMany<TrendingGenreRow>();
  }

  /** Languages with the most public pieces published within the window. */
  trendingLanguages(lookbackDays: number, limit: number): Promise<TrendingLanguageRow[]> {
    return this.dataSource
      .createQueryBuilder()
      .select('l.code', 'code')
      .addSelect('l.native_name', 'nativeName')
      .addSelect('l.direction', 'direction')
      .addSelect('COUNT(*)::int', 'pieceCount')
      .from('pieces', 'p')
      .innerJoin('languages', 'l', 'l.id = p.language_id')
      .where('p.status = :published', { published: PieceStatus.Published })
      .andWhere('p.visibility = :public', { public: Visibility.Public })
      .andWhere('p.deleted_at IS NULL')
      .andWhere(`p.published_at > now() - (:lookbackDays * interval '1 day')`, { lookbackDays })
      .groupBy('l.id')
      .orderBy('"pieceCount"', 'DESC')
      .addOrderBy('l.code', 'ASC')
      .limit(limit)
      .getRawMany<TrendingLanguageRow>();
  }
}
