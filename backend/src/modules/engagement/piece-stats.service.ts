import { Injectable } from '@nestjs/common';

import { PiecesService } from '../pieces/pieces.service';
import type { PieceEngagementDto } from './dto/piece-engagement.dto';
import { PieceStatsRepository } from './piece-stats.repository';
import { ReactionsRepository } from './reactions.repository';

/**
 * Read side of engagement (docs 04 §7): the piece's denormalized counts plus the
 * viewer's own like/clap/bookmark state, for the reading surface's engagement
 * bar. All O(1) counter reads — never `COUNT(*)`.
 */
@Injectable()
export class PieceStatsService {
  constructor(
    private readonly pieceStats: PieceStatsRepository,
    private readonly reactions: ReactionsRepository,
    private readonly pieces: PiecesService,
  ) {}

  async getEngagement(pieceId: string, viewerId: string | null): Promise<PieceEngagementDto> {
    // Same visibility + published gate as any engagement path (privacy-preserving).
    await this.pieces.getEngageablePiece(pieceId, viewerId);
    const counts = await this.pieceStats.getCounts(pieceId);

    let viewer = { hasLiked: false, clapCount: 0, hasBookmarked: false };
    if (viewerId !== null) {
      const [hasLiked, clapCount, hasBookmarked] = await Promise.all([
        this.reactions.hasLiked(viewerId, pieceId),
        this.reactions.getClapCount(viewerId, pieceId),
        this.reactions.hasBookmarked(viewerId, pieceId),
      ]);
      viewer = { hasLiked, clapCount, hasBookmarked };
    }

    return {
      stats: {
        likes: counts.likes,
        claps: counts.claps,
        bookmarks: counts.bookmarks,
        comments: counts.comments,
        responses: counts.responses,
        shares: counts.shares,
      },
      viewer,
    };
  }
}
