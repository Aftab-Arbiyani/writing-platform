import { Injectable } from '@nestjs/common';
import { FeedSort, FollowStatus, PieceStatus, Visibility } from '@qalam/shared';
import { DataSource } from 'typeorm';
import type { SelectQueryBuilder } from 'typeorm';

import type { CursorPayload } from '../../common/pagination/cursor.util';
import {
  buildTrendingScoreSql,
  trendingScoreParams,
  type TrendingWeights,
} from './scoring/trending-scoring';

/** One feed card, straight from the joined query (raw aliases → DTO in the service). */
export interface CardRow {
  id: string;
  slug: string | null;
  title: string;
  subtitle: string | null;
  featuredQuote: string | null;
  coverImageKey: string | null;
  visibility: Visibility;
  wordCount: number;
  readingTimeSeconds: number;
  publishedAt: Date | null;
  langCode: string;
  langDirection: string;
  langNativeName: string;
  genreSlug: string | null;
  genreName: string | null;
  username: string;
  penName: string | null;
  avatarKey: string | null;
  likesCount: number;
  clapsCount: number;
  commentsCount: number;
  responsesCount: number;
}

/** Resolved filters (codes/slugs already resolved to ids by the service). */
export interface ResolvedFeedFilters {
  languageIds?: string[];
  genreIds?: string[];
  tagSlug?: string;
  visibility?: Visibility;
  dateFrom?: string;
  dateTo?: string;
  minReadingTime?: number;
  maxReadingTime?: number;
}

/** The exact card columns — one definition shared by the query builder + raw SQL. */
const CARD_COLUMNS: string[] = [
  'p.id AS "id"',
  'p.slug AS "slug"',
  'p.title AS "title"',
  'p.subtitle AS "subtitle"',
  'p.featured_quote AS "featuredQuote"',
  'p.cover_image_key AS "coverImageKey"',
  'p.visibility AS "visibility"',
  'p.word_count AS "wordCount"',
  'p.reading_time_seconds AS "readingTimeSeconds"',
  'p.published_at AS "publishedAt"',
  'p.author_id AS "authorId"',
  'l.code AS "langCode"',
  'l.direction AS "langDirection"',
  'l.native_name AS "langNativeName"',
  'g.slug AS "genreSlug"',
  'g.name AS "genreName"',
  'u.username AS "username"',
  'pr.pen_name AS "penName"',
  'pr.avatar_key AS "avatarKey"',
  'COALESCE(ps.likes_count, 0) AS "likesCount"',
  'COALESCE(ps.claps_count, 0) AS "clapsCount"',
  'COALESCE(ps.comments_count, 0) AS "commentsCount"',
  'COALESCE(ps.responses_count, 0) AS "responsesCount"',
];

/**
 * Read-only feed queries over existing tables (no new entities). Fully decoupled
 * from other modules — it reads tables by name via the DataSource query builder
 * rather than importing their entities/repositories (docs 16 §3.1). Every card is
 * hydrated in ONE joined query (no N+1), and every list is keyset-paginated over
 * an indexed sort key.
 */
@Injectable()
export class FeedRepository {
  constructor(private readonly dataSource: DataSource) {}

  /** pieces + stats + author + language + genre, selecting only card fields. */
  private baseCardQuery(): SelectQueryBuilder<Record<string, unknown>> {
    return this.dataSource
      .createQueryBuilder()
      .select(CARD_COLUMNS)
      .from('pieces', 'p')
      .leftJoin('piece_stats', 'ps', 'ps.piece_id = p.id')
      .innerJoin('users', 'u', 'u.id = p.author_id')
      .leftJoin('profiles', 'pr', 'pr.user_id = p.author_id')
      .innerJoin('languages', 'l', 'l.id = p.language_id')
      .leftJoin('genres', 'g', 'g.id = p.genre_id')
      .where('p.status = :published', { published: PieceStatus.Published })
      .andWhere('p.deleted_at IS NULL');
  }

  private applyFilters(
    qb: SelectQueryBuilder<Record<string, unknown>>,
    f: ResolvedFeedFilters,
  ): void {
    if (f.languageIds && f.languageIds.length > 0) {
      qb.andWhere('p.language_id IN (:...languageIds)', { languageIds: f.languageIds });
    }
    if (f.genreIds && f.genreIds.length > 0) {
      qb.andWhere('p.genre_id IN (:...genreIds)', { genreIds: f.genreIds });
    }
    if (f.tagSlug !== undefined) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM piece_tags pt JOIN tags t ON t.id = pt.tag_id
                 WHERE pt.piece_id = p.id AND t.slug = :tagSlug)`,
        { tagSlug: f.tagSlug },
      );
    }
    if (f.visibility !== undefined) {
      qb.andWhere('p.visibility = :filterVisibility', { filterVisibility: f.visibility });
    }
    if (f.dateFrom !== undefined) {
      qb.andWhere('p.published_at >= :dateFrom::timestamptz', { dateFrom: f.dateFrom });
    }
    if (f.dateTo !== undefined) {
      qb.andWhere('p.published_at <= :dateTo::timestamptz', { dateTo: f.dateTo });
    }
    if (f.minReadingTime !== undefined) {
      qb.andWhere('p.reading_time_seconds >= :minRt', { minRt: f.minReadingTime });
    }
    if (f.maxReadingTime !== undefined) {
      qb.andWhere('p.reading_time_seconds <= :maxRt', { maxRt: f.maxReadingTime });
    }
  }

  /** Latest / most-clapped / most-discussed over public pieces (private authors excluded). */
  listPublic(
    sort: Exclude<FeedSort, 'trending'>,
    filters: ResolvedFeedFilters,
    cursor: CursorPayload | null,
    limit: number,
  ): Promise<CardRow[]> {
    const qb = this.baseCardQuery()
      .andWhere('p.visibility = :public', { public: Visibility.Public })
      .andWhere('(pr.is_private = false OR pr.is_private IS NULL)')
      .limit(limit + 1);
    this.applyFilters(qb, filters);
    this.applySort(qb, sort, cursor);
    return qb.getRawMany<CardRow>();
  }

  /**
   * Following feed: public + unlisted pieces from accepted-followed authors,
   * newest-published first. The accepted-follow join is itself the private-account
   * authorization (a follower may see a private author's pieces, docs 13 §4.2).
   */
  listFollowing(
    viewerId: string,
    filters: ResolvedFeedFilters,
    cursor: CursorPayload | null,
    limit: number,
  ): Promise<CardRow[]> {
    const qb = this.baseCardQuery()
      .innerJoin(
        'follows',
        'f',
        'f.followee_id = p.author_id AND f.follower_id = :viewerId AND f.status = :accepted',
        { viewerId, accepted: FollowStatus.Accepted },
      )
      .andWhere('p.visibility IN (:...visible)', {
        visible: [Visibility.Public, Visibility.Unlisted],
      })
      .limit(limit + 1);
    this.applyFilters(qb, filters);
    this.applySort(qb, FeedSort.Latest, cursor);
    return qb.getRawMany<CardRow>();
  }

  /**
   * Discover: one piece per author (DISTINCT ON) — their most recent public piece
   * — recency-ordered and keyset-paginated. Guarantees no duplicate authors on a
   * page; recency naturally mixes genres/languages. Private authors excluded.
   * Raw SQL because DISTINCT ON + an outer keyset order is clearest that way.
   */
  async listDiscover(cursor: CursorPayload | null, limit: number): Promise<CardRow[]> {
    const sql = `
      WITH latest_per_author AS (
        SELECT DISTINCT ON (p.author_id) ${CARD_COLUMNS.join(', ')}
        FROM pieces p
        LEFT JOIN piece_stats ps ON ps.piece_id = p.id
        INNER JOIN users u ON u.id = p.author_id
        LEFT JOIN profiles pr ON pr.user_id = p.author_id
        INNER JOIN languages l ON l.id = p.language_id
        LEFT JOIN genres g ON g.id = p.genre_id
        WHERE p.status = 'published' AND p.deleted_at IS NULL AND p.visibility = 'public'
          AND (pr.is_private = false OR pr.is_private IS NULL)
        ORDER BY p.author_id, p.published_at DESC, p.id DESC
      )
      SELECT * FROM latest_per_author
      WHERE ($1::timestamptz IS NULL OR ("publishedAt", "id") < ($1::timestamptz, $2::uuid))
      ORDER BY "publishedAt" DESC, "id" DESC
      LIMIT $3`;
    return this.dataSource.query(sql, [
      cursor?.k ?? null,
      cursor?.id ?? null,
      limit + 1,
    ]) as Promise<CardRow[]>;
  }

  /**
   * Computes the trending ranking (top-N piece ids + scores) using the configured
   * weights. Public, non-private, within the lookback window. Ordered by the live
   * score — the result is cached in Redis by the service (no background worker).
   */
  computeTrendingRanking(
    weights: TrendingWeights,
    snapshotSize: number,
  ): Promise<Array<{ pieceId: string; score: number }>> {
    const scoreSql = buildTrendingScoreSql('p', 'ps');
    return this.dataSource
      .createQueryBuilder()
      .select('p.id', 'pieceId')
      .addSelect(scoreSql, 'score')
      .from('pieces', 'p')
      .leftJoin('piece_stats', 'ps', 'ps.piece_id = p.id')
      .leftJoin('profiles', 'pr', 'pr.user_id = p.author_id')
      .where('p.status = :published', { published: PieceStatus.Published })
      .andWhere('p.deleted_at IS NULL')
      .andWhere('p.visibility = :public', { public: Visibility.Public })
      .andWhere('(pr.is_private = false OR pr.is_private IS NULL)')
      .andWhere(`p.published_at > now() - (:lookbackDays * interval '1 day')`, {
        lookbackDays: weights.lookbackDays,
      })
      .orderBy('score', 'DESC')
      .addOrderBy('p.id', 'DESC')
      .limit(snapshotSize)
      .setParameters(trendingScoreParams(weights))
      .getRawMany<{ pieceId: string; score: number }>();
  }

  /** Hydrates a set of piece ids into cards, preserving the given id order. */
  async listByIds(ids: string[]): Promise<CardRow[]> {
    if (ids.length === 0) {
      return [];
    }
    const qb = this.baseCardQuery()
      .andWhere('p.id = ANY(:ids)', { ids })
      .andWhere('p.visibility = :public', { public: Visibility.Public })
      .andWhere('(pr.is_private = false OR pr.is_private IS NULL)')
      .orderBy('array_position(:ids::uuid[], p.id)', 'ASC');
    return qb.getRawMany<CardRow>();
  }

  private applySort(
    qb: SelectQueryBuilder<Record<string, unknown>>,
    sort: Exclude<FeedSort, 'trending'>,
    cursor: CursorPayload | null,
  ): void {
    if (sort === FeedSort.MostClapped || sort === FeedSort.MostDiscussed) {
      const col = sort === FeedSort.MostClapped ? 'ps.claps_count' : 'ps.comments_count';
      const expr = `COALESCE(${col}, 0)`;
      qb.orderBy(expr, 'DESC').addOrderBy('p.id', 'DESC');
      if (cursor !== null) {
        qb.andWhere(`(${expr}, p.id) < (:ck::int, :cid::uuid)`, { ck: cursor.k, cid: cursor.id });
      }
      return;
    }
    // Latest (also the Following + date-filtered default).
    qb.orderBy('p.published_at', 'DESC').addOrderBy('p.id', 'DESC');
    if (cursor !== null) {
      qb.andWhere('(p.published_at, p.id) < (:ck::timestamptz, :cid::uuid)', {
        ck: cursor.k,
        cid: cursor.id,
      });
    }
  }
}

/** The cursor key for a card under a given sort (published_at ISO or a count). */
export function cardCursorKey(row: CardRow, sort: FeedSort): string {
  if (sort === FeedSort.MostClapped) {
    return String(row.clapsCount);
  }
  if (sort === FeedSort.MostDiscussed) {
    return String(row.commentsCount);
  }
  return row.publishedAt !== null ? new Date(row.publishedAt).toISOString() : '';
}
