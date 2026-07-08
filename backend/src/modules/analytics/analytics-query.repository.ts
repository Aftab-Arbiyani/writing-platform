import { Injectable } from '@nestjs/common';
import { PieceStatus, Visibility } from '@qalam/shared';
import { DataSource } from 'typeorm';

/** Raw aggregate rows (bigint columns arrive as strings; mappers coerce). */
export interface PieceAnalyticsRow {
  pieceId: string;
  authorId: string;
  views: string;
  uniqueViews: string;
  reads: string;
  totalReadSeconds: string;
  completedReads: string;
  sharesInternal: number;
  sharesExternal: number;
  sharesCopyLink: number;
  publishedAt: Date | null;
}
export interface WriterAnalyticsRow {
  userId: string;
  views: string;
  uniqueViews: string;
  reads: string;
  totalReadSeconds: string;
  completedReads: string;
  followersGained: number;
  piecesPublished: number;
  piecesArchived: number;
}
export interface ReaderAnalyticsRow {
  userId: string;
  piecesRead: string;
  reads: string;
  totalReadSeconds: string;
  completedReads: string;
  lastReadOn: string | null;
  currentStreak: number;
  longestStreak: number;
}
export interface EngagementCounts {
  claps: number;
  comments: number;
  bookmarks: number;
  responses: number;
}
export interface RankedRow {
  key: string;
  label: string;
  count: number;
}

const PUBLIC_PIECE = `p.status = '${PieceStatus.Published}' AND p.visibility = '${Visibility.Public}' AND p.deleted_at IS NULL`;

/**
 * The READ side of analytics — every query is bounded (by subject id / a time
 * window / an index), never a blind full scan (docs perf rule). Aggregate reads
 * hit satellite PKs; roll-ups sum a writer's own pieces (indexed by author);
 * trending reads the windowed `view_event`; platform COUNTs are admin-only +
 * Redis-cached by the service. Reads other domains' tables by name (docs 16 §3.1).
 */
@Injectable()
export class AnalyticsQueryRepository {
  constructor(private readonly dataSource: DataSource) {}

  private async one<T>(sql: string, params: unknown[]): Promise<T | null> {
    const rows = (await this.dataSource.query(sql, params)) as T[];
    return rows[0] ?? null;
  }

  // ── Piece ────────────────────────────────────────────────────────────────

  getPieceAnalytics(pieceId: string): Promise<PieceAnalyticsRow | null> {
    return this.one<PieceAnalyticsRow>(
      `SELECT piece_id AS "pieceId", author_id AS "authorId", views, unique_views AS "uniqueViews",
              reads, total_read_seconds AS "totalReadSeconds", completed_reads AS "completedReads",
              shares_internal AS "sharesInternal", shares_external AS "sharesExternal",
              shares_copy_link AS "sharesCopyLink", published_at AS "publishedAt"
       FROM piece_analytics WHERE piece_id = $1`,
      [pieceId],
    );
  }

  /** The piece's owner (for authorization) + display, from `pieces`. */
  getPieceMeta(
    pieceId: string,
  ): Promise<{ authorId: string; title: string; slug: string | null } | null> {
    return this.one(
      `SELECT author_id AS "authorId", title, slug FROM pieces WHERE id = $1 AND deleted_at IS NULL`,
      [pieceId],
    );
  }

  /** Engagement counts from `piece_stats` (not duplicated in analytics). */
  async getPieceEngagement(pieceId: string): Promise<EngagementCounts> {
    const row = await this.one<EngagementCounts>(
      `SELECT COALESCE(claps_count,0) AS claps, COALESCE(comments_count,0) AS comments,
              COALESCE(bookmarks_count,0) AS bookmarks, COALESCE(responses_count,0) AS responses
       FROM piece_stats WHERE piece_id = $1`,
      [pieceId],
    );
    return row ?? { claps: 0, comments: 0, bookmarks: 0, responses: 0 };
  }

  // ── Writer ─────────────────────────────────────────────────────────────────

  getWriterAnalytics(userId: string): Promise<WriterAnalyticsRow | null> {
    return this.one<WriterAnalyticsRow>(
      `SELECT user_id AS "userId", views, unique_views AS "uniqueViews", reads,
              total_read_seconds AS "totalReadSeconds", completed_reads AS "completedReads",
              followers_gained AS "followersGained", pieces_published AS "piecesPublished",
              pieces_archived AS "piecesArchived"
       FROM writer_analytics WHERE user_id = $1`,
      [userId],
    );
  }

  /** Engagement RECEIVED = sum of the writer's pieces' piece_stats (indexed by author). */
  async getWriterReceivedEngagement(userId: string): Promise<EngagementCounts> {
    const row = await this.one<EngagementCounts>(
      `SELECT COALESCE(SUM(ps.claps_count),0)::int AS claps,
              COALESCE(SUM(ps.comments_count),0)::int AS comments,
              COALESCE(SUM(ps.bookmarks_count),0)::int AS bookmarks,
              COALESCE(SUM(ps.responses_count),0)::int AS responses
       FROM pieces p JOIN piece_stats ps ON ps.piece_id = p.id
       WHERE p.author_id = $1 AND p.deleted_at IS NULL`,
      [userId],
    );
    return row ?? { claps: 0, comments: 0, bookmarks: 0, responses: 0 };
  }

  getWriterMostPopular(
    userId: string,
  ): Promise<{ pieceId: string; title: string; slug: string | null; views: string } | null> {
    return this.one(
      `SELECT pa.piece_id AS "pieceId", p.title, p.slug, pa.views
       FROM piece_analytics pa JOIN pieces p ON p.id = pa.piece_id AND p.deleted_at IS NULL
       WHERE pa.author_id = $1
       ORDER BY pa.views DESC, pa.piece_id DESC LIMIT 1`,
      [userId],
    );
  }

  // ── Reader ─────────────────────────────────────────────────────────────────

  getReaderAnalytics(userId: string): Promise<ReaderAnalyticsRow | null> {
    return this.one<ReaderAnalyticsRow>(
      `SELECT user_id AS "userId", pieces_read AS "piecesRead", reads,
              total_read_seconds AS "totalReadSeconds", completed_reads AS "completedReads",
              last_read_on AS "lastReadOn", current_streak AS "currentStreak",
              longest_streak AS "longestStreak"
       FROM reader_analytics WHERE user_id = $1`,
      [userId],
    );
  }

  readerFavoriteGenres(userId: string, limit: number): Promise<RankedRow[]> {
    return this.dataSource.query(
      `SELECT g.slug AS key, g.name AS label, COUNT(*)::int AS count
       FROM read_event re JOIN pieces p ON p.id = re.piece_id JOIN genres g ON g.id = p.genre_id
       WHERE re.reader_id = $1 GROUP BY g.id ORDER BY count DESC, g.slug ASC LIMIT $2`,
      [userId, limit],
    ) as Promise<RankedRow[]>;
  }

  readerFavoriteLanguages(userId: string, limit: number): Promise<RankedRow[]> {
    return this.dataSource.query(
      `SELECT l.code AS key, l.native_name AS label, COUNT(*)::int AS count
       FROM read_event re JOIN pieces p ON p.id = re.piece_id JOIN languages l ON l.id = p.language_id
       WHERE re.reader_id = $1 GROUP BY l.id ORDER BY count DESC, l.code ASC LIMIT $2`,
      [userId, limit],
    ) as Promise<RankedRow[]>;
  }

  // ── Platform ────────────────────────────────────────────────────────────────

  getPlatformCounters(): Promise<Record<string, string> | null> {
    return this.one(
      `SELECT views, unique_views AS "uniqueViews", reads, completed_reads AS "completedReads",
              published_pieces AS "publishedPieces", archived_pieces AS "archivedPieces",
              comments, claps, bookmarks, responses, shares, follows
       FROM platform_analytics WHERE id = 'global'`,
      [],
    );
  }

  private async count(sql: string, params: unknown[] = []): Promise<number> {
    const row = await this.one<{ count: string }>(sql, params);
    return Number(row?.count ?? 0);
  }

  countUsers(): Promise<number> {
    return this.count(`SELECT COUNT(*) AS count FROM users WHERE deleted_at IS NULL`);
  }
  countActiveUsers(days: number): Promise<number> {
    return this.count(
      `SELECT COUNT(*) AS count FROM users
       WHERE deleted_at IS NULL AND last_login_at > now() - ($1 * interval '1 day')`,
      [days],
    );
  }
  countPiecesByStatus(status: PieceStatus): Promise<number> {
    return this.count(
      `SELECT COUNT(*) AS count FROM pieces WHERE status = $1 AND deleted_at IS NULL`,
      [status],
    );
  }
  countCollections(): Promise<number> {
    return this.count(`SELECT COUNT(*) AS count FROM collections WHERE deleted_at IS NULL`);
  }
  countRegistrations(days: number): Promise<number> {
    return this.count(
      `SELECT COUNT(*) AS count FROM users
       WHERE deleted_at IS NULL AND created_at > now() - ($1 * interval '1 day')`,
      [days],
    );
  }

  topLanguages(limit: number): Promise<RankedRow[]> {
    return this.dataSource.query(
      `SELECT l.code AS key, l.native_name AS label, COUNT(p.id)::int AS count
       FROM languages l JOIN pieces p ON p.language_id = l.id AND ${PUBLIC_PIECE}
       GROUP BY l.id ORDER BY count DESC, l.code ASC LIMIT $1`,
      [limit],
    ) as Promise<RankedRow[]>;
  }
  topGenres(limit: number): Promise<RankedRow[]> {
    return this.dataSource.query(
      `SELECT g.slug AS key, g.name AS label, COUNT(p.id)::int AS count
       FROM genres g JOIN pieces p ON p.genre_id = g.id AND ${PUBLIC_PIECE}
       GROUP BY g.id ORDER BY count DESC, g.slug ASC LIMIT $1`,
      [limit],
    ) as Promise<RankedRow[]>;
  }
  topTags(limit: number): Promise<RankedRow[]> {
    return this.dataSource.query(
      `SELECT t.slug AS key, t.name AS label, COUNT(*)::int AS count
       FROM piece_tags pt JOIN tags t ON t.id = pt.tag_id
       JOIN pieces p ON p.id = pt.piece_id AND ${PUBLIC_PIECE}
       GROUP BY t.id ORDER BY count DESC, t.slug ASC LIMIT $1`,
      [limit],
    ) as Promise<RankedRow[]>;
  }
  topWriters(limit: number): Promise<RankedRow[]> {
    return this.dataSource.query(
      `SELECT wa.user_id AS key, u.username AS label, wa.views::int AS count
       FROM writer_analytics wa JOIN users u ON u.id = wa.user_id AND u.deleted_at IS NULL
       ORDER BY wa.views DESC, wa.user_id DESC LIMIT $1`,
      [limit],
    ) as Promise<RankedRow[]>;
  }

  // ── Trending (windowed recent unique-view signal) ──────────────────────────

  trendingPieces(windowDays: number, limit: number): Promise<RankedRow[]> {
    return this.dataSource.query(
      `SELECT p.id AS key, p.title AS label, ve.recent AS count
       FROM (SELECT piece_id, COUNT(*)::int AS recent FROM view_event
             WHERE created_at > now() - ($1 * interval '1 day') GROUP BY piece_id) ve
       JOIN pieces p ON p.id = ve.piece_id AND ${PUBLIC_PIECE}
       ORDER BY ve.recent DESC, p.id DESC LIMIT $2`,
      [windowDays, limit],
    ) as Promise<RankedRow[]>;
  }
  trendingWriters(windowDays: number, limit: number): Promise<RankedRow[]> {
    return this.dataSource.query(
      `SELECT p.author_id AS key, u.username AS label, COUNT(*)::int AS count
       FROM view_event ve JOIN pieces p ON p.id = ve.piece_id AND ${PUBLIC_PIECE}
       JOIN users u ON u.id = p.author_id AND u.deleted_at IS NULL
       WHERE ve.created_at > now() - ($1 * interval '1 day')
       GROUP BY p.author_id, u.username ORDER BY count DESC, p.author_id DESC LIMIT $2`,
      [windowDays, limit],
    ) as Promise<RankedRow[]>;
  }
  trendingGenres(windowDays: number, limit: number): Promise<RankedRow[]> {
    return this.dataSource.query(
      `SELECT g.slug AS key, g.name AS label, COUNT(*)::int AS count
       FROM view_event ve JOIN pieces p ON p.id = ve.piece_id AND ${PUBLIC_PIECE}
       JOIN genres g ON g.id = p.genre_id
       WHERE ve.created_at > now() - ($1 * interval '1 day')
       GROUP BY g.id ORDER BY count DESC, g.slug ASC LIMIT $2`,
      [windowDays, limit],
    ) as Promise<RankedRow[]>;
  }
  trendingTags(windowDays: number, limit: number): Promise<RankedRow[]> {
    return this.dataSource.query(
      `SELECT t.slug AS key, t.name AS label, COUNT(*)::int AS count
       FROM view_event ve JOIN piece_tags pt ON pt.piece_id = ve.piece_id
       JOIN tags t ON t.id = pt.tag_id
       JOIN pieces p ON p.id = ve.piece_id AND ${PUBLIC_PIECE}
       WHERE ve.created_at > now() - ($1 * interval '1 day')
       GROUP BY t.id ORDER BY count DESC, t.slug ASC LIMIT $2`,
      [windowDays, limit],
    ) as Promise<RankedRow[]>;
  }

  // ── Snapshots (growth) ──────────────────────────────────────────────────────

  getSnapshots(
    scope: string,
    subjectId: string,
    period: string,
    limit: number,
  ): Promise<Array<{ periodStart: string; metrics: Record<string, number> }>> {
    return this.dataSource.query(
      `SELECT period_start AS "periodStart", metrics FROM analytics_snapshot
       WHERE scope = $1 AND subject_id = $2 AND period = $3
       ORDER BY period_start DESC LIMIT $4`,
      [scope, subjectId, period, limit],
    ) as Promise<Array<{ periodStart: string; metrics: Record<string, number> }>>;
  }

  /** Active writers (have a writer_analytics row) — for platform snapshot fan-out. */
  activeWriterIds(): Promise<string[]> {
    return this.dataSource
      .query(`SELECT user_id AS id FROM writer_analytics`)
      .then((rows: Array<{ id: string }>) => rows.map((r) => r.id));
  }
}
