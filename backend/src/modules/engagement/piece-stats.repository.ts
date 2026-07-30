import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { EntityManager, Repository } from 'typeorm';

import { PieceStats } from './entities/piece-stats.entity';

/** The engagement counters that move on the request path (docs 04 §7 layer 1). */
export interface EngagementDeltas {
  likes?: number;
  claps?: number;
  bookmarks?: number;
  comments?: number;
  responses?: number;
  shares?: number;
}

/** O(1) counts read from `piece_stats` (never `COUNT(*)`). */
export interface PieceStatCounts {
  likes: number;
  claps: number;
  bookmarks: number;
  comments: number;
  responses: number;
  shares: number;
}

const ZERO: PieceStatCounts = {
  likes: 0,
  claps: 0,
  bookmarks: 0,
  comments: 0,
  responses: 0,
  shares: 0,
};

/**
 * Data access for `piece_stats` (docs 04 §3.14). The satellite row is created
 * lazily by {@link increment} (the E4 pieces predate this table), then bumped
 * transactionally alongside each engagement write. Deltas are server-controlled
 * integers passed as bound parameters (docs 13 §6 — no interpolation).
 */
@Injectable()
export class PieceStatsRepository {
  constructor(private readonly dataSource: DataSource) {}

  private manager(manager?: EntityManager): EntityManager {
    return manager ?? this.dataSource.manager;
  }

  private repo(manager?: EntityManager): Repository<PieceStats> {
    return this.manager(manager).getRepository(PieceStats);
  }

  /** Reads the counts for one piece; all-zero when no stats row exists yet. */
  async getCounts(pieceId: string, manager?: EntityManager): Promise<PieceStatCounts> {
    const row = await this.repo(manager).findOne({ where: { pieceId } });
    if (row === null) {
      return { ...ZERO };
    }
    return {
      likes: row.likesCount,
      claps: row.clapsCount,
      bookmarks: row.bookmarksCount,
      comments: row.commentsCount,
      responses: row.responsesCount,
      shares: row.sharesCount,
    };
  }

  /**
   * Creates-or-increments the counters for a piece atomically (upsert). Called
   * inside the same transaction as the engagement write so the counter can never
   * drift from its source row within a request (docs 04 §7).
   */
  async increment(
    pieceId: string,
    deltas: EngagementDeltas,
    manager?: EntityManager,
  ): Promise<void> {
    await this.manager(manager).query(
      `INSERT INTO piece_stats
         (piece_id, likes_count, claps_count, bookmarks_count, comments_count, responses_count, shares_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (piece_id) DO UPDATE SET
         likes_count     = piece_stats.likes_count     + EXCLUDED.likes_count,
         claps_count     = piece_stats.claps_count     + EXCLUDED.claps_count,
         bookmarks_count = piece_stats.bookmarks_count + EXCLUDED.bookmarks_count,
         comments_count  = piece_stats.comments_count  + EXCLUDED.comments_count,
         responses_count = piece_stats.responses_count + EXCLUDED.responses_count,
         shares_count    = piece_stats.shares_count    + EXCLUDED.shares_count,
         updated_at      = now()`,
      [
        pieceId,
        deltas.likes ?? 0,
        deltas.claps ?? 0,
        deltas.bookmarks ?? 0,
        deltas.comments ?? 0,
        deltas.responses ?? 0,
        deltas.shares ?? 0,
      ],
    );
  }
}
