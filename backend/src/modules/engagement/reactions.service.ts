import { Injectable } from '@nestjs/common';
import { MAX_CLAPS_PER_USER_PER_PIECE } from '@qalam/shared';

import { TransactionRunner } from '../../common/database/transaction-runner';
import { decodeCursor } from '../../common/pagination/cursor.util';
import { buildCursorPage } from '../../common/pagination/pagination.helper';
import type { CursorPage } from '../../common/types/paginated-result';
import { PiecesService } from '../pieces/pieces.service';
import type {
  BookmarkItemDto,
  BookmarkResponseDto,
  ClapResponseDto,
  LikeResponseDto,
} from './dto/reaction.dto';
import { ClapLimitReachedException } from './exceptions/engagement.exceptions';
import { PieceStatsRepository } from './piece-stats.repository';
import type { BookmarkRow } from './reactions.repository';
import { ReactionsRepository } from './reactions.repository';

/**
 * Likes, claps, and bookmarks (docs 04 §3.4, docs 18 E7). Every write pairs the
 * engagement row with its `piece_stats` counter bump in one transaction (docs 04
 * §7 layer 1). Toggles are idempotent; claps accumulate to
 * `MAX_CLAPS_PER_USER_PER_PIECE`, capped race-safely at the DB (§3.4).
 * Engagement is only allowed on a published, visible piece — enforced by
 * `PiecesService.getEngageablePiece` so the visibility rule is never duplicated.
 */
@Injectable()
export class ReactionsService {
  constructor(
    private readonly reactions: ReactionsRepository,
    private readonly pieceStats: PieceStatsRepository,
    private readonly pieces: PiecesService,
    private readonly transactions: TransactionRunner,
  ) {}

  // ── likes ────────────────────────────────────────────────────────────────

  /** Like a piece (idempotent — a second like is a no-op). */
  async like(pieceId: string, userId: string): Promise<LikeResponseDto> {
    await this.pieces.getEngageablePiece(pieceId, userId);
    await this.transactions.run(async (manager) => {
      if (!(await this.reactions.hasLiked(userId, pieceId, manager))) {
        await this.reactions.insertLike(userId, pieceId, manager);
        await this.pieceStats.increment(pieceId, { likes: 1 }, manager);
      }
    });
    const counts = await this.pieceStats.getCounts(pieceId);
    return { liked: true, totalLikes: counts.likes };
  }

  /** Unlike a piece (idempotent — no-op if not liked). Allowed regardless of status. */
  async unlike(pieceId: string, userId: string): Promise<void> {
    await this.transactions.run(async (manager) => {
      if (await this.reactions.deleteLike(userId, pieceId, manager)) {
        await this.pieceStats.increment(pieceId, { likes: -1 }, manager);
      }
    });
  }

  // ── claps ────────────────────────────────────────────────────────────────

  /**
   * Add `count` claps. Applies `min(count, 50 - current)`; a request when already
   * at 50 fails with `CLAP_LIMIT_REACHED` (docs 05 §11.7). The DB caps at 50 via
   * `LEAST(…)` + the CHECK; the applied delta feeds `piece_stats.claps_count`.
   */
  async clap(pieceId: string, userId: string, count: number): Promise<ClapResponseDto> {
    await this.pieces.getEngageablePiece(pieceId, userId);
    return this.transactions.run(async (manager) => {
      const current = await this.reactions.getClapCount(userId, pieceId, manager);
      if (current >= MAX_CLAPS_PER_USER_PER_PIECE) {
        throw new ClapLimitReachedException();
      }
      const viewerClaps = await this.reactions.upsertClap(userId, pieceId, count, manager);
      const delta = viewerClaps - current;
      if (delta > 0) {
        await this.pieceStats.increment(pieceId, { claps: delta }, manager);
      }
      const counts = await this.pieceStats.getCounts(pieceId, manager);
      return { viewerClaps, totalClaps: counts.claps };
    });
  }

  /** Remove all of the viewer's claps from a piece (resets to 0). Idempotent. */
  async removeClaps(pieceId: string, userId: string): Promise<void> {
    await this.transactions.run(async (manager) => {
      const current = await this.reactions.getClapCount(userId, pieceId, manager);
      if (current > 0 && (await this.reactions.deleteClap(userId, pieceId, manager))) {
        await this.pieceStats.increment(pieceId, { claps: -current }, manager);
      }
    });
  }

  // ── bookmarks (private) ────────────────────────────────────────────────────

  async bookmark(pieceId: string, userId: string): Promise<BookmarkResponseDto> {
    await this.pieces.getEngageablePiece(pieceId, userId);
    await this.transactions.run(async (manager) => {
      if (!(await this.reactions.hasBookmarked(userId, pieceId, manager))) {
        await this.reactions.insertBookmark(userId, pieceId, manager);
        await this.pieceStats.increment(pieceId, { bookmarks: 1 }, manager);
      }
    });
    return { bookmarked: true };
  }

  async removeBookmark(pieceId: string, userId: string): Promise<void> {
    await this.transactions.run(async (manager) => {
      if (await this.reactions.deleteBookmark(userId, pieceId, manager)) {
        await this.pieceStats.increment(pieceId, { bookmarks: -1 }, manager);
      }
    });
  }

  /** The owner's private bookmark list, cursor-paginated (docs 05 §5.1). */
  async listBookmarks(
    userId: string,
    rawCursor: string | undefined,
    limit: number,
  ): Promise<CursorPage<BookmarkItemDto>> {
    const rows = await this.reactions.listBookmarks(userId, decodeCursor(rawCursor), limit);
    const page = buildCursorPage(rows, limit, (r) => ({
      k: new Date(r.createdAt).toISOString(),
      id: r.bookmarkId,
    }));
    return { items: page.items.map(toBookmarkItem), meta: page.meta };
  }
}

function toBookmarkItem(row: BookmarkRow): BookmarkItemDto {
  return {
    pieceId: row.pieceId,
    slug: row.slug,
    title: row.title,
    bookmarkedAt: new Date(row.createdAt).toISOString(),
  };
}
