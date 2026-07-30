import type { PiecesService } from '../pieces/pieces.service';
import type { PieceStatsRepository } from './piece-stats.repository';
import { PieceStatsService } from './piece-stats.service';
import type { ReactionsRepository } from './reactions.repository';

function build(reactionOverrides: Partial<Record<string, jest.Mock>> = {}) {
  const pieceStats = {
    getCounts: jest.fn().mockResolvedValue({
      likes: 5,
      claps: 40,
      bookmarks: 2,
      comments: 3,
      responses: 1,
      shares: 7,
    }),
  };
  const reactions = {
    hasLiked: jest.fn().mockResolvedValue(true),
    getClapCount: jest.fn().mockResolvedValue(12),
    hasBookmarked: jest.fn().mockResolvedValue(false),
    ...reactionOverrides,
  };
  const pieces = { getEngageablePiece: jest.fn().mockResolvedValue({ id: 'p1' }) };
  const service = new PieceStatsService(
    pieceStats as unknown as PieceStatsRepository,
    reactions as unknown as ReactionsRepository,
    pieces as unknown as PiecesService,
  );
  return { service, reactions, pieces };
}

describe('PieceStatsService — engagement summary', () => {
  it('returns counts + the viewer’s own state for an authenticated viewer', async () => {
    const { service } = build();
    const result = await service.getEngagement('p1', 'viewer');
    expect(result.stats).toEqual({
      likes: 5,
      claps: 40,
      bookmarks: 2,
      comments: 3,
      responses: 1,
      shares: 7,
    });
    expect(result.viewer).toEqual({ hasLiked: true, clapCount: 12, hasBookmarked: false });
  });

  it('returns empty viewer state for an anonymous viewer (no reaction lookups)', async () => {
    const { service, reactions } = build();
    const result = await service.getEngagement('p1', null);
    expect(result.viewer).toEqual({ hasLiked: false, clapCount: 0, hasBookmarked: false });
    expect(reactions.hasLiked).not.toHaveBeenCalled();
  });

  it('gates on piece visibility before reading counts', async () => {
    const { service, pieces } = build();
    await service.getEngagement('p1', 'viewer');
    expect(pieces.getEngageablePiece).toHaveBeenCalledWith('p1', 'viewer');
  });
});
