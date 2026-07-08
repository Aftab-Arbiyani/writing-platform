import { Injectable } from '@nestjs/common';
import type { ShareChannel } from '@qalam/shared';

import { TransactionRunner } from '../../common/database/transaction-runner';
import { PiecesService } from '../pieces/pieces.service';
import type { ShareResponseDto } from './dto/share.dto';
import { PieceStatsRepository } from './piece-stats.repository';
import { SharesRepository } from './shares.repository';

/**
 * Share tracking (E7 — ADR §10). Phase 1 records the COUNT only (no analytics
 * dashboard): each share appends a `shares` row and bumps
 * `piece_stats.shares_count` transactionally. Sharing is allowed for anonymous
 * readers of a public piece (`userId` may be null) — the same visibility gate as
 * reading, via `PiecesService.getEngageablePiece`.
 */
@Injectable()
export class SharesService {
  constructor(
    private readonly shares: SharesRepository,
    private readonly pieceStats: PieceStatsRepository,
    private readonly pieces: PiecesService,
    private readonly transactions: TransactionRunner,
  ) {}

  async share(
    pieceId: string,
    userId: string | null,
    channel: ShareChannel,
  ): Promise<ShareResponseDto> {
    await this.pieces.getEngageablePiece(pieceId, userId);
    const counts = await this.transactions.run(async (manager) => {
      await this.shares.create({ userId, pieceId, channel }, manager);
      await this.pieceStats.increment(pieceId, { shares: 1 }, manager);
      return this.pieceStats.getCounts(pieceId, manager);
    });
    return { totalShares: counts.shares };
  }
}
