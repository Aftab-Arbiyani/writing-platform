import { ShareChannel } from '@qalam/shared';
import type { EntityManager } from 'typeorm';

import type { TransactionRunner } from '../../common/database/transaction-runner';
import type { DomainEventBus } from '../../common/events/domain-event-bus';
import type { PiecesService } from '../pieces/pieces.service';
import type { PieceStatsRepository } from './piece-stats.repository';
import type { SharesRepository } from './shares.repository';
import { SharesService } from './shares.service';

const tx = {
  run: (w: (m: EntityManager) => Promise<unknown>) => w({} as EntityManager),
} as unknown as TransactionRunner;

function build() {
  const shares = { create: jest.fn().mockResolvedValue(undefined) };
  const pieceStats = {
    increment: jest.fn().mockResolvedValue(undefined),
    getCounts: jest.fn().mockResolvedValue({
      likes: 0,
      claps: 0,
      bookmarks: 0,
      comments: 0,
      responses: 0,
      shares: 3,
    }),
  };
  const pieces = { getEngageablePiece: jest.fn().mockResolvedValue({ id: 'p1', authorId: 'a1' }) };
  const service = new SharesService(
    shares as unknown as SharesRepository,
    pieceStats as unknown as PieceStatsRepository,
    pieces as unknown as PiecesService,
    tx,
    { emit: jest.fn().mockResolvedValue(undefined) } as unknown as DomainEventBus,
  );
  return { service, shares, pieceStats };
}

describe('SharesService', () => {
  it('records a share and bumps shares_count', async () => {
    const { service, shares, pieceStats } = build();
    const result = await service.share('p1', 'u1', ShareChannel.External);
    expect(shares.create).toHaveBeenCalledWith(
      { userId: 'u1', pieceId: 'p1', channel: ShareChannel.External },
      expect.anything(),
    );
    expect(pieceStats.increment).toHaveBeenCalledWith('p1', { shares: 1 }, expect.anything());
    expect(result.totalShares).toBe(3);
  });

  it('records an anonymous share (null user id)', async () => {
    const { service, shares } = build();
    await service.share('p1', null, ShareChannel.CopyLink);
    expect(shares.create).toHaveBeenCalledWith(
      { userId: null, pieceId: 'p1', channel: ShareChannel.CopyLink },
      expect.anything(),
    );
  });
});
