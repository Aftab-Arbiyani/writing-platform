import { MAX_CLAPS_PER_USER_PER_PIECE } from '@qalam/shared';
import type { EntityManager } from 'typeorm';

import type { TransactionRunner } from '../../common/database/transaction-runner';
import type { PiecesService } from '../pieces/pieces.service';
import { ClapLimitReachedException } from './exceptions/engagement.exceptions';
import type { PieceStatsRepository } from './piece-stats.repository';
import type { ReactionsRepository } from './reactions.repository';
import { ReactionsService } from './reactions.service';

const tx = {
  run: (w: (m: EntityManager) => Promise<unknown>) => w({} as EntityManager),
} as unknown as TransactionRunner;

function build(reactionOverrides: Partial<Record<string, jest.Mock>> = {}) {
  const reactions = {
    hasLiked: jest.fn().mockResolvedValue(false),
    insertLike: jest.fn().mockResolvedValue(undefined),
    deleteLike: jest.fn().mockResolvedValue(true),
    getClapCount: jest.fn().mockResolvedValue(0),
    upsertClap: jest.fn().mockResolvedValue(1),
    deleteClap: jest.fn().mockResolvedValue(true),
    hasBookmarked: jest.fn().mockResolvedValue(false),
    insertBookmark: jest.fn().mockResolvedValue(undefined),
    deleteBookmark: jest.fn().mockResolvedValue(true),
    ...reactionOverrides,
  };
  const pieceStats = {
    increment: jest.fn().mockResolvedValue(undefined),
    getCounts: jest.fn().mockResolvedValue({
      likes: 1,
      claps: 10,
      bookmarks: 1,
      comments: 0,
      responses: 0,
      shares: 0,
    }),
  };
  const pieces = { getEngageablePiece: jest.fn().mockResolvedValue({ id: 'p1', authorId: 'a' }) };
  const service = new ReactionsService(
    reactions as unknown as ReactionsRepository,
    pieceStats as unknown as PieceStatsRepository,
    pieces as unknown as PiecesService,
    tx,
  );
  return { service, reactions, pieceStats, pieces };
}

describe('ReactionsService — likes', () => {
  it('likes a piece and bumps the counter once', async () => {
    const { service, reactions, pieceStats } = build();
    const result = await service.like('p1', 'u1');
    expect(reactions.insertLike).toHaveBeenCalledTimes(1);
    expect(pieceStats.increment).toHaveBeenCalledWith('p1', { likes: 1 }, expect.anything());
    expect(result.liked).toBe(true);
  });

  it('is idempotent — a second like does not double-count', async () => {
    const { service, reactions, pieceStats } = build({
      hasLiked: jest.fn().mockResolvedValue(true),
    });
    await service.like('p1', 'u1');
    expect(reactions.insertLike).not.toHaveBeenCalled();
    expect(pieceStats.increment).not.toHaveBeenCalled();
  });

  it('requires the piece to be engageable (published + visible)', async () => {
    const { service, pieces } = build();
    await service.like('p1', 'u1');
    expect(pieces.getEngageablePiece).toHaveBeenCalledWith('p1', 'u1');
  });

  it('unlikes only decrements when a row was actually removed', async () => {
    const { service, pieceStats } = build({ deleteLike: jest.fn().mockResolvedValue(false) });
    await service.unlike('p1', 'u1');
    expect(pieceStats.increment).not.toHaveBeenCalled();
  });
});

describe('ReactionsService — claps', () => {
  it('applies the delta between old and new clap totals', async () => {
    const { service, pieceStats } = build({
      getClapCount: jest.fn().mockResolvedValue(3),
      upsertClap: jest.fn().mockResolvedValue(8), // added 5
    });
    const result = await service.clap('p1', 'u1', 5);
    expect(pieceStats.increment).toHaveBeenCalledWith('p1', { claps: 5 }, expect.anything());
    expect(result.viewerClaps).toBe(8);
    expect(result.totalClaps).toBe(10);
  });

  it('caps at 50 — the applied delta never exceeds the remaining room', async () => {
    const { service, pieceStats } = build({
      getClapCount: jest.fn().mockResolvedValue(48),
      upsertClap: jest.fn().mockResolvedValue(50), // 48 + 5 capped to 50
    });
    const result = await service.clap('p1', 'u1', 5);
    expect(pieceStats.increment).toHaveBeenCalledWith('p1', { claps: 2 }, expect.anything());
    expect(result.viewerClaps).toBe(50);
  });

  it('rejects the 51st clap when already at the cap', async () => {
    const { service } = build({
      getClapCount: jest.fn().mockResolvedValue(MAX_CLAPS_PER_USER_PER_PIECE),
    });
    await expect(service.clap('p1', 'u1', 1)).rejects.toBeInstanceOf(ClapLimitReachedException);
  });

  it('removeClaps resets the counter by the current amount', async () => {
    const { service, pieceStats } = build({ getClapCount: jest.fn().mockResolvedValue(7) });
    await service.removeClaps('p1', 'u1');
    expect(pieceStats.increment).toHaveBeenCalledWith('p1', { claps: -7 }, expect.anything());
  });
});

describe('ReactionsService — bookmarks', () => {
  it('bookmarks once (idempotent) and bumps the counter', async () => {
    const { service, reactions, pieceStats } = build();
    const result = await service.bookmark('p1', 'u1');
    expect(reactions.insertBookmark).toHaveBeenCalledTimes(1);
    expect(pieceStats.increment).toHaveBeenCalledWith('p1', { bookmarks: 1 }, expect.anything());
    expect(result.bookmarked).toBe(true);
  });

  it('does not double-count an existing bookmark', async () => {
    const { service, reactions } = build({ hasBookmarked: jest.fn().mockResolvedValue(true) });
    await service.bookmark('p1', 'u1');
    expect(reactions.insertBookmark).not.toHaveBeenCalled();
  });
});
