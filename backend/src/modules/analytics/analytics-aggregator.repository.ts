import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

/** Deltas applied to a piece's aggregate (absent = 0). */
export interface PieceDelta {
  views?: number;
  uniqueViews?: number;
  reads?: number;
  totalReadSeconds?: number;
  completedReads?: number;
  sharesInternal?: number;
  sharesExternal?: number;
  sharesCopyLink?: number;
}

/** Deltas applied to a writer's aggregate (absent = 0). */
export interface WriterDelta {
  views?: number;
  uniqueViews?: number;
  reads?: number;
  totalReadSeconds?: number;
  completedReads?: number;
  followersGained?: number;
  piecesPublished?: number;
  piecesArchived?: number;
}

/** Deltas applied to the platform singleton (absent = 0). */
export interface PlatformDelta {
  views?: number;
  uniqueViews?: number;
  reads?: number;
  completedReads?: number;
  publishedPieces?: number;
  archivedPieces?: number;
  comments?: number;
  claps?: number;
  bookmarks?: number;
  responses?: number;
  shares?: number;
  follows?: number;
}

/**
 * The WRITE side of analytics — atomic counter upserts on the aggregate tables +
 * the raw view/read event records. Only the event LISTENER calls this (business
 * modules never touch analytics). Everything is a single-row INSERT … ON CONFLICT
 * DO UPDATE (no read-modify-write, no scans); rows are created lazily so
 * pre-existing pieces/users work without a backfill.
 */
@Injectable()
export class AnalyticsAggregatorRepository {
  constructor(private readonly dataSource: DataSource) {}

  /** Upserts a piece aggregate, incrementing the provided counters. */
  async incrementPiece(
    pieceId: string,
    authorId: string,
    delta: PieceDelta,
    publishedAt: Date | null = null,
  ): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO piece_analytics
         (piece_id, author_id, views, unique_views, reads, total_read_seconds, completed_reads,
          shares_internal, shares_external, shares_copy_link, published_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
       ON CONFLICT (piece_id) DO UPDATE SET
         views = piece_analytics.views + EXCLUDED.views,
         unique_views = piece_analytics.unique_views + EXCLUDED.unique_views,
         reads = piece_analytics.reads + EXCLUDED.reads,
         total_read_seconds = piece_analytics.total_read_seconds + EXCLUDED.total_read_seconds,
         completed_reads = piece_analytics.completed_reads + EXCLUDED.completed_reads,
         shares_internal = piece_analytics.shares_internal + EXCLUDED.shares_internal,
         shares_external = piece_analytics.shares_external + EXCLUDED.shares_external,
         shares_copy_link = piece_analytics.shares_copy_link + EXCLUDED.shares_copy_link,
         published_at = COALESCE(piece_analytics.published_at, EXCLUDED.published_at),
         updated_at = now()`,
      [
        pieceId,
        authorId,
        delta.views ?? 0,
        delta.uniqueViews ?? 0,
        delta.reads ?? 0,
        delta.totalReadSeconds ?? 0,
        delta.completedReads ?? 0,
        delta.sharesInternal ?? 0,
        delta.sharesExternal ?? 0,
        delta.sharesCopyLink ?? 0,
        publishedAt,
      ],
    );
  }

  /** Upserts a writer aggregate, incrementing the provided counters. */
  async incrementWriter(userId: string, delta: WriterDelta): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO writer_analytics
         (user_id, views, unique_views, reads, total_read_seconds, completed_reads,
          followers_gained, pieces_published, pieces_archived, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
       ON CONFLICT (user_id) DO UPDATE SET
         views = writer_analytics.views + EXCLUDED.views,
         unique_views = writer_analytics.unique_views + EXCLUDED.unique_views,
         reads = writer_analytics.reads + EXCLUDED.reads,
         total_read_seconds = writer_analytics.total_read_seconds + EXCLUDED.total_read_seconds,
         completed_reads = writer_analytics.completed_reads + EXCLUDED.completed_reads,
         followers_gained = writer_analytics.followers_gained + EXCLUDED.followers_gained,
         pieces_published = writer_analytics.pieces_published + EXCLUDED.pieces_published,
         pieces_archived = writer_analytics.pieces_archived + EXCLUDED.pieces_archived,
         updated_at = now()`,
      [
        userId,
        delta.views ?? 0,
        delta.uniqueViews ?? 0,
        delta.reads ?? 0,
        delta.totalReadSeconds ?? 0,
        delta.completedReads ?? 0,
        delta.followersGained ?? 0,
        delta.piecesPublished ?? 0,
        delta.piecesArchived ?? 0,
      ],
    );
  }

  /** Increments the platform singleton counters. */
  async incrementPlatform(delta: PlatformDelta): Promise<void> {
    await this.dataSource.query(
      `UPDATE platform_analytics SET
         views = views + $1,
         unique_views = unique_views + $2,
         reads = reads + $3,
         completed_reads = completed_reads + $4,
         published_pieces = published_pieces + $5,
         archived_pieces = archived_pieces + $6,
         comments = comments + $7,
         claps = claps + $8,
         bookmarks = bookmarks + $9,
         responses = responses + $10,
         shares = shares + $11,
         follows = follows + $12,
         updated_at = now()
       WHERE id = 'global'`,
      [
        delta.views ?? 0,
        delta.uniqueViews ?? 0,
        delta.reads ?? 0,
        delta.completedReads ?? 0,
        delta.publishedPieces ?? 0,
        delta.archivedPieces ?? 0,
        delta.comments ?? 0,
        delta.claps ?? 0,
        delta.bookmarks ?? 0,
        delta.responses ?? 0,
        delta.shares ?? 0,
        delta.follows ?? 0,
      ],
    );
  }

  /**
   * Upserts a reader aggregate with streak logic done atomically in SQL:
   * same day → unchanged; consecutive day → +1; gap → reset to 1.
   */
  async upsertReader(
    userId: string,
    delta: { piecesRead: number; reads: number; totalReadSeconds: number; completedReads: number },
    today: string,
  ): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO reader_analytics
         (user_id, pieces_read, reads, total_read_seconds, completed_reads,
          last_read_on, current_streak, longest_streak, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6, 1, 1, now())
       ON CONFLICT (user_id) DO UPDATE SET
         pieces_read = reader_analytics.pieces_read + EXCLUDED.pieces_read,
         reads = reader_analytics.reads + EXCLUDED.reads,
         total_read_seconds = reader_analytics.total_read_seconds + EXCLUDED.total_read_seconds,
         completed_reads = reader_analytics.completed_reads + EXCLUDED.completed_reads,
         current_streak = CASE
           WHEN reader_analytics.last_read_on = EXCLUDED.last_read_on THEN reader_analytics.current_streak
           WHEN reader_analytics.last_read_on = EXCLUDED.last_read_on::date - 1 THEN reader_analytics.current_streak + 1
           ELSE 1 END,
         longest_streak = GREATEST(
           reader_analytics.longest_streak,
           CASE
             WHEN reader_analytics.last_read_on = EXCLUDED.last_read_on THEN reader_analytics.current_streak
             WHEN reader_analytics.last_read_on = EXCLUDED.last_read_on::date - 1 THEN reader_analytics.current_streak + 1
             ELSE 1 END),
         last_read_on = EXCLUDED.last_read_on,
         updated_at = now()`,
      [userId, delta.piecesRead, delta.reads, delta.totalReadSeconds, delta.completedReads, today],
    );
  }

  /**
   * Records a unique view (one row per piece+viewer). Returns true when this is
   * the FIRST view by this viewer (row inserted), false when it already existed.
   */
  async recordUniqueView(
    pieceId: string,
    viewerKey: string,
    viewerId: string | null,
    isAuthenticated: boolean,
  ): Promise<boolean> {
    const rows = (await this.dataSource.query(
      `INSERT INTO view_event (id, piece_id, viewer_key, viewer_id, is_authenticated, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5, now(), now())
       ON CONFLICT (piece_id, viewer_key) DO NOTHING
       RETURNING id`,
      [uuidv7(), pieceId, viewerKey, viewerId, isAuthenticated],
    )) as unknown[];
    return rows.length > 0;
  }

  /** Records a read session. */
  async insertReadEvent(
    pieceId: string,
    readerId: string | null,
    durationSeconds: number,
    completionPct: number,
  ): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO read_event (id, piece_id, reader_id, duration_seconds, completion_pct, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5, now(), now())`,
      [uuidv7(), pieceId, readerId, durationSeconds, completionPct],
    );
  }

  /** Whether this reader has never read this piece before (for distinct piecesRead). */
  async isFirstRead(readerId: string, pieceId: string): Promise<boolean> {
    const rows = (await this.dataSource.query(
      `SELECT 1 FROM read_event WHERE reader_id = $1 AND piece_id = $2 LIMIT 1`,
      [readerId, pieceId],
    )) as unknown[];
    return rows.length === 0;
  }

  /** Idempotent upsert of a snapshot row (growth history). */
  async upsertSnapshot(
    scope: string,
    subjectId: string,
    period: string,
    periodStart: string,
    metrics: Record<string, number>,
  ): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO analytics_snapshot (id, scope, subject_id, period, period_start, metrics, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6, now(), now())
       ON CONFLICT (scope, subject_id, period, period_start)
       DO UPDATE SET metrics = EXCLUDED.metrics, updated_at = now()`,
      [uuidv7(), scope, subjectId, period, periodStart, JSON.stringify(metrics)],
    );
  }
}
