import { Injectable } from '@nestjs/common';
import { PieceStatus, SearchSort, UserStatus, Visibility } from '@qalam/shared';
import { DataSource } from 'typeorm';
import type { SelectQueryBuilder } from 'typeorm';

import type { CursorPayload } from '../../common/pagination/cursor.util';
import { toContainsPattern, toPrefixPattern } from './search.util';

/** ── Raw row shapes (aliases → DTOs happen in the mappers) ─────────────────── */

export interface SearchPieceRow {
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
  trendingScore: number;
  relevance: number;
}

export interface SearchWriterRow {
  userId: string;
  username: string;
  penName: string | null;
  avatarKey: string | null;
  bio: string | null;
  isPrivate: boolean;
  followersCount: number;
  piecesCount: number;
  relevance: number;
}

export interface SearchTagRow {
  id: string;
  slug: string;
  name: string;
  pieceCount: number;
}
export interface SearchGenreRow {
  id: string;
  slug: string;
  name: string;
  pieceCount: number;
}
export interface SearchLanguageRow {
  id: string;
  code: string;
  nativeName: string;
  direction: string;
  pieceCount: number;
}

export interface WriterSuggestionRow {
  username: string;
  penName: string | null;
  avatarKey: string | null;
}
export interface TagSuggestionRow {
  slug: string;
  name: string;
}
export interface GenreSuggestionRow {
  slug: string;
  name: string;
}
export interface PieceSuggestionRow {
  slug: string | null;
  title: string;
}
export interface PopularWriterRow {
  username: string;
  penName: string | null;
  avatarKey: string | null;
  followersCount: number;
}

/** Filters already resolved to ids/slugs by the service (docs 16 §3.1). */
export interface ResolvedPieceFilters {
  languageIds?: string[];
  genreIds?: string[];
  tagSlug?: string;
  author?: string;
  visibility?: Visibility;
  dateFrom?: string;
  dateTo?: string;
  minReadingTime?: number;
  maxReadingTime?: number;
}

/** Reused so query terms match the lexemes the stored tsvectors were built from. */
const TSQUERY = `websearch_to_tsquery('simple', immutable_unaccent(:q))`;

/** Piece relevance: FTS rank over the vector + a trigram boost on the title. */
const PIECE_RANK = `(ts_rank(p.search_vector, ${TSQUERY}) + similarity(p.title, :q))`;

/** Writer relevance: FTS over pen_name/bio (public only) + trigram over the name. */
const WRITER_RANK = `((CASE WHEN pr.is_private = false THEN ts_rank(pr.search_vector, ${TSQUERY}) ELSE 0 END) + GREATEST(similarity(u.username::text, :q), similarity(pr.pen_name, :q)))`;

const PIECE_COLUMNS: string[] = [
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
  'COALESCE(ps.trending_score, 0) AS "trendingScore"',
];

const WRITER_COLUMNS: string[] = [
  'u.id AS "userId"',
  'u.username AS "username"',
  'pr.pen_name AS "penName"',
  'pr.avatar_key AS "avatarKey"',
  'pr.bio AS "bio"',
  'pr.is_private AS "isPrivate"',
  'pr.followers_count AS "followersCount"',
  'pr.pieces_count AS "piecesCount"',
];

/**
 * Read-only Postgres FTS queries over existing tables (no cross-module entity
 * imports, docs 16 §3.1). Query terms are always bound parameters and go through
 * `websearch_to_tsquery` (never `to_tsquery`) so arbitrary user input can't throw
 * or inject (docs 13 §6). Every list keyset-paginates over an indexed sort key
 * and every card/result is hydrated in ONE joined query (no N+1). Visibility is
 * enforced HERE: published + public + non-private author, always (docs 13 §4.2).
 */
@Injectable()
export class SearchRepository {
  constructor(private readonly dataSource: DataSource) {}

  // ── Pieces ─────────────────────────────────────────────────────────────────

  private basePieceQuery(): SelectQueryBuilder<Record<string, unknown>> {
    return this.dataSource
      .createQueryBuilder()
      .select(PIECE_COLUMNS)
      .from('pieces', 'p')
      .leftJoin('piece_stats', 'ps', 'ps.piece_id = p.id')
      .innerJoin('users', 'u', 'u.id = p.author_id')
      .leftJoin('profiles', 'pr', 'pr.user_id = p.author_id')
      .innerJoin('languages', 'l', 'l.id = p.language_id')
      .leftJoin('genres', 'g', 'g.id = p.genre_id')
      .where('p.status = :published', { published: PieceStatus.Published })
      .andWhere('p.deleted_at IS NULL')
      .andWhere('p.visibility = :public', { public: Visibility.Public })
      .andWhere('(pr.is_private = false OR pr.is_private IS NULL)');
  }

  searchPieces(
    q: string,
    filters: ResolvedPieceFilters,
    sort: SearchSort,
    cursor: CursorPayload | null,
    limit: number,
  ): Promise<SearchPieceRow[]> {
    const qb = this.basePieceQuery()
      .addSelect(PIECE_RANK, 'relevance')
      .andWhere(
        `(
          p.search_vector @@ ${TSQUERY}
          OR p.title % :q
          OR p.featured_quote ILIKE :qcontains
          OR p.slug = :qslug
          OR EXISTS (
            SELECT 1 FROM piece_tags pt JOIN tags t ON t.id = pt.tag_id
            WHERE pt.piece_id = p.id AND (t.slug = :qslug OR t.name % :q OR t.name ILIKE :qcontains)
          )
        )`,
      )
      .setParameters({ q, qslug: q, qcontains: toContainsPattern(q) })
      .limit(limit + 1);

    this.applyPieceFilters(qb, filters);
    this.applyPieceSort(qb, sort, cursor);
    return qb.getRawMany<SearchPieceRow>();
  }

  private applyPieceFilters(
    qb: SelectQueryBuilder<Record<string, unknown>>,
    f: ResolvedPieceFilters,
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
                 WHERE pt.piece_id = p.id AND t.slug = :filterTag)`,
        { filterTag: f.tagSlug },
      );
    }
    if (f.author !== undefined) {
      qb.andWhere('u.username = :author', { author: f.author });
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

  private applyPieceSort(
    qb: SelectQueryBuilder<Record<string, unknown>>,
    sort: SearchSort,
    cursor: CursorPayload | null,
  ): void {
    if (sort === SearchSort.Latest) {
      qb.orderBy('p.published_at', 'DESC').addOrderBy('p.id', 'DESC');
      if (cursor !== null) {
        qb.andWhere('(p.published_at, p.id) < (:ck::timestamptz, :cid::uuid)', {
          ck: cursor.k,
          cid: cursor.id,
        });
      }
      return;
    }
    if (sort === SearchSort.MostClapped || sort === SearchSort.MostCommented) {
      const col = sort === SearchSort.MostClapped ? 'ps.claps_count' : 'ps.comments_count';
      const expr = `COALESCE(${col}, 0)`;
      qb.orderBy(expr, 'DESC').addOrderBy('p.id', 'DESC');
      if (cursor !== null) {
        qb.andWhere(`(${expr}, p.id) < (:ck::int, :cid::uuid)`, { ck: cursor.k, cid: cursor.id });
      }
      return;
    }
    if (sort === SearchSort.Trending) {
      const expr = 'COALESCE(ps.trending_score, 0)';
      qb.orderBy(expr, 'DESC').addOrderBy('p.id', 'DESC');
      if (cursor !== null) {
        qb.andWhere(`(${expr}, p.id) < (:ck::float8, :cid::uuid)`, {
          ck: cursor.k,
          cid: cursor.id,
        });
      }
      return;
    }
    // Relevance (default): ts_rank + trigram boost, highest first.
    qb.orderBy('relevance', 'DESC').addOrderBy('p.id', 'DESC');
    if (cursor !== null) {
      qb.andWhere(`(${PIECE_RANK}, p.id) < (:ck::float8, :cid::uuid)`, {
        ck: cursor.k,
        cid: cursor.id,
      });
    }
  }

  // ── Writers ──────────────────────────────────────────────────────────────

  searchWriters(
    q: string,
    languageId: string | undefined,
    genreSlug: string | undefined,
    cursor: CursorPayload | null,
    limit: number,
  ): Promise<SearchWriterRow[]> {
    const qb = this.dataSource
      .createQueryBuilder()
      .select(WRITER_COLUMNS)
      .addSelect(WRITER_RANK, 'relevance')
      .from('profiles', 'pr')
      .innerJoin('users', 'u', 'u.id = pr.user_id')
      .where('u.status = :active', { active: UserStatus.Active })
      .andWhere('u.deleted_at IS NULL')
      // Bio (search_vector) is matched for PUBLIC profiles only — a private
      // account is findable by name but never by its bio content (docs 13 §4.2).
      .andWhere(
        `(
          (pr.is_private = false AND pr.search_vector @@ ${TSQUERY})
          OR u.username::text ILIKE :qlike OR pr.pen_name ILIKE :qlike
          OR u.username::text % :q OR pr.pen_name % :q
        )`,
      )
      .setParameters({ q, qlike: toPrefixPattern(q) })
      .limit(limit + 1);

    if (languageId !== undefined) {
      qb.andWhere('pr.default_language_id = :languageId', { languageId });
    }
    if (genreSlug !== undefined) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM profile_genres pg JOIN genres g ON g.id = pg.genre_id
                 WHERE pg.profile_id = pr.id AND g.slug = :genreSlug)`,
        { genreSlug },
      );
    }

    qb.orderBy('relevance', 'DESC').addOrderBy('u.id', 'DESC');
    if (cursor !== null) {
      qb.andWhere(`(${WRITER_RANK}, u.id) < (:ck::float8, :cid::uuid)`, {
        ck: cursor.k,
        cid: cursor.id,
      });
    }
    return qb.getRawMany<SearchWriterRow>();
  }

  // ── Tags ─────────────────────────────────────────────────────────────────

  /**
   * The `pieceCount` is aggregated from public published pieces (private/unlisted
   * excluded) rather than read from the `tags.pieces_count` denormalized counter,
   * which the writing engine does not yet maintain and which would otherwise
   * over-count non-public pieces. The `tag` browse (q = null) is cached by the
   * service (trending), so this aggregate runs at most once per TTL.
   */
  searchTags(
    q: string | null,
    cursor: CursorPayload | null,
    limit: number,
  ): Promise<SearchTagRow[]> {
    const sql = `
      WITH counts AS (
        SELECT t.id AS "id", t.slug AS "slug", t.name AS "name",
          COUNT(p.id) FILTER (WHERE pr.is_private = false OR pr.is_private IS NULL)::int AS "pieceCount"
        FROM tags t
        LEFT JOIN piece_tags pt ON pt.tag_id = t.id
        LEFT JOIN pieces p ON p.id = pt.piece_id
          AND p.status = 'published' AND p.visibility = 'public' AND p.deleted_at IS NULL
        LEFT JOIN profiles pr ON pr.user_id = p.author_id
        WHERE ($1::text IS NULL OR t.name ILIKE $2 OR t.slug::text ILIKE $2
               OR t.name % $1 OR t.slug::text % $1)
        GROUP BY t.id
      )
      SELECT * FROM counts
      WHERE ($3::int IS NULL OR ("pieceCount", "id") < ($3::int, $4::uuid))
      ORDER BY "pieceCount" DESC, "id" DESC
      LIMIT $5`;
    return this.dataSource.query(sql, [
      q,
      q === null ? null : toPrefixPattern(q),
      cursor?.k ?? null,
      cursor?.id ?? null,
      limit + 1,
    ]) as Promise<SearchTagRow[]>;
  }

  // ── Genres (aggregated public-piece counts; small reference set) ───────────

  searchGenres(
    q: string | null,
    cursor: CursorPayload | null,
    limit: number,
  ): Promise<SearchGenreRow[]> {
    const sql = `
      WITH counts AS (
        SELECT g.id AS "id", g.slug AS "slug", g.name AS "name",
          COUNT(p.id) FILTER (WHERE pr.is_private = false OR pr.is_private IS NULL)::int AS "pieceCount"
        FROM genres g
        LEFT JOIN pieces p ON p.genre_id = g.id
          AND p.status = 'published' AND p.visibility = 'public' AND p.deleted_at IS NULL
        LEFT JOIN profiles pr ON pr.user_id = p.author_id
        WHERE g.is_active = true
          AND ($1::text IS NULL OR g.name ILIKE $2 OR g.slug::text ILIKE $2
               OR g.name % $1 OR g.slug::text % $1)
        GROUP BY g.id
      )
      SELECT * FROM counts
      WHERE ($3::int IS NULL OR ("pieceCount", "id") < ($3::int, $4::uuid))
      ORDER BY "pieceCount" DESC, "id" DESC
      LIMIT $5`;
    return this.dataSource.query(sql, [
      q,
      q === null ? null : toPrefixPattern(q),
      cursor?.k ?? null,
      cursor?.id ?? null,
      limit + 1,
    ]) as Promise<SearchGenreRow[]>;
  }

  // ── Languages (aggregated public-piece counts; small reference set) ────────

  searchLanguages(
    q: string | null,
    cursor: CursorPayload | null,
    limit: number,
  ): Promise<SearchLanguageRow[]> {
    const sql = `
      WITH counts AS (
        SELECT l.id AS "id", l.code AS "code", l.native_name AS "nativeName",
          l.direction AS "direction",
          COUNT(p.id) FILTER (WHERE pr.is_private = false OR pr.is_private IS NULL)::int AS "pieceCount"
        FROM languages l
        LEFT JOIN pieces p ON p.language_id = l.id
          AND p.status = 'published' AND p.visibility = 'public' AND p.deleted_at IS NULL
        LEFT JOIN profiles pr ON pr.user_id = p.author_id
        WHERE l.is_active = true
          AND ($1::text IS NULL OR l.native_name ILIKE $2 OR l.name_en ILIKE $2
               OR l.code ILIKE $2 OR l.native_name % $1 OR l.name_en % $1)
        GROUP BY l.id
      )
      SELECT * FROM counts
      WHERE ($3::int IS NULL OR ("pieceCount", "id") < ($3::int, $4::uuid))
      ORDER BY "pieceCount" DESC, "id" DESC
      LIMIT $5`;
    return this.dataSource.query(sql, [
      q,
      q === null ? null : toPrefixPattern(q),
      cursor?.k ?? null,
      cursor?.id ?? null,
      limit + 1,
    ]) as Promise<SearchLanguageRow[]>;
  }

  // ── Autocomplete (prefix-first, ≤ 10) ─────────────────────────────────────

  autocompleteWriters(q: string, limit: number): Promise<WriterSuggestionRow[]> {
    return this.dataSource
      .createQueryBuilder()
      .select([
        'u.username AS "username"',
        'pr.pen_name AS "penName"',
        'pr.avatar_key AS "avatarKey"',
      ])
      .addSelect('(u.username::text ILIKE :qlike OR pr.pen_name ILIKE :qlike)', 'isPrefix')
      .from('profiles', 'pr')
      .innerJoin('users', 'u', 'u.id = pr.user_id')
      .where('u.status = :active', { active: UserStatus.Active })
      .andWhere('u.deleted_at IS NULL')
      .andWhere(
        '(u.username::text ILIKE :qlike OR pr.pen_name ILIKE :qlike OR u.username::text % :q OR pr.pen_name % :q)',
        { q, qlike: toPrefixPattern(q) },
      )
      .orderBy('"isPrefix"', 'DESC')
      .addOrderBy('pr.followers_count', 'DESC')
      .addOrderBy('u.id', 'DESC')
      .limit(limit)
      .getRawMany<WriterSuggestionRow>();
  }

  autocompleteTags(q: string, limit: number): Promise<TagSuggestionRow[]> {
    return this.dataSource
      .createQueryBuilder()
      .select(['t.slug AS "slug"', 't.name AS "name"'])
      .addSelect('(t.name ILIKE :qlike OR t.slug::text ILIKE :qlike)', 'isPrefix')
      .from('tags', 't')
      .where(
        '(t.name ILIKE :qlike OR t.slug::text ILIKE :qlike OR t.name % :q OR t.slug::text % :q)',
        { q, qlike: toPrefixPattern(q) },
      )
      .orderBy('"isPrefix"', 'DESC')
      .addOrderBy('t.pieces_count', 'DESC')
      .addOrderBy('t.id', 'DESC')
      .limit(limit)
      .getRawMany<TagSuggestionRow>();
  }

  autocompleteGenres(q: string, limit: number): Promise<GenreSuggestionRow[]> {
    return this.dataSource
      .createQueryBuilder()
      .select(['g.slug AS "slug"', 'g.name AS "name"'])
      .addSelect('(g.name ILIKE :qlike OR g.slug::text ILIKE :qlike)', 'isPrefix')
      .from('genres', 'g')
      .where('g.is_active = true')
      .andWhere(
        '(g.name ILIKE :qlike OR g.slug::text ILIKE :qlike OR g.name % :q OR g.slug::text % :q)',
        { q, qlike: toPrefixPattern(q) },
      )
      .orderBy('"isPrefix"', 'DESC')
      .addOrderBy('g.sort_order', 'ASC')
      .addOrderBy('g.name', 'ASC')
      .limit(limit)
      .getRawMany<GenreSuggestionRow>();
  }

  autocompletePieces(q: string, limit: number): Promise<PieceSuggestionRow[]> {
    return this.dataSource
      .createQueryBuilder()
      .select(['p.slug AS "slug"', 'p.title AS "title"'])
      .addSelect('(p.title ILIKE :qlike)', 'isPrefix')
      .from('pieces', 'p')
      .innerJoin('users', 'u', 'u.id = p.author_id')
      .leftJoin('profiles', 'pr', 'pr.user_id = p.author_id')
      .where('p.status = :published', { published: PieceStatus.Published })
      .andWhere('p.deleted_at IS NULL')
      .andWhere('p.visibility = :public', { public: Visibility.Public })
      .andWhere('(pr.is_private = false OR pr.is_private IS NULL)')
      .andWhere('(p.title ILIKE :qlike OR p.title % :q)', { q, qlike: toPrefixPattern(q) })
      .orderBy('"isPrefix"', 'DESC')
      .addOrderBy('p.published_at', 'DESC')
      .addOrderBy('p.id', 'DESC')
      .limit(limit)
      .getRawMany<PieceSuggestionRow>();
  }

  // ── Trending: popular writers (most-followed public writers) ───────────────

  popularWriters(limit: number): Promise<PopularWriterRow[]> {
    return this.dataSource
      .createQueryBuilder()
      .select([
        'u.username AS "username"',
        'pr.pen_name AS "penName"',
        'pr.avatar_key AS "avatarKey"',
        'pr.followers_count AS "followersCount"',
      ])
      .from('profiles', 'pr')
      .innerJoin('users', 'u', 'u.id = pr.user_id')
      .where('pr.is_private = false')
      .andWhere('u.status = :active', { active: UserStatus.Active })
      .andWhere('u.deleted_at IS NULL')
      .andWhere('pr.followers_count > 0')
      .orderBy('pr.followers_count', 'DESC')
      .addOrderBy('u.id', 'DESC')
      .limit(limit)
      .getRawMany<PopularWriterRow>();
  }
}
