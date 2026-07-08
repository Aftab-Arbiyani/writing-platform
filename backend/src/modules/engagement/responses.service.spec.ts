import type { EntityManager } from 'typeorm';

import type { TransactionRunner } from '../../common/database/transaction-runner';
import type { PiecesService } from '../pieces/pieces.service';
import type { PieceResponseDto } from '../pieces/dto/piece-response.dto';
import { ResponsesService } from './responses.service';
import type { ResponsesRepository } from './responses.repository';
import type { PieceStatsRepository } from './piece-stats.repository';

const tx = {
  run: (w: (m: EntityManager) => Promise<unknown>) => w({} as EntityManager),
} as unknown as TransactionRunner;

function build() {
  const responses = {
    create: jest.fn().mockResolvedValue(undefined),
    listByParent: jest.fn().mockResolvedValue([]),
  };
  const pieceStats = { increment: jest.fn().mockResolvedValue(undefined) };
  const pieces = {
    getEngageablePiece: jest.fn().mockResolvedValue({ id: 'parent', authorId: 'a' }),
    createDraft: jest.fn().mockResolvedValue({ id: 'resp1', title: 'A reply' } as PieceResponseDto),
  };
  const service = new ResponsesService(
    responses as unknown as ResponsesRepository,
    pieceStats as unknown as PieceStatsRepository,
    pieces as unknown as PiecesService,
    tx,
  );
  return { service, responses, pieceStats, pieces };
}

describe('ResponsesService', () => {
  it('creates a response piece, links it, and bumps the parent responses_count', async () => {
    const { service, responses, pieceStats, pieces } = build();
    const dto = await service.create('parent', 'author', { languageCode: 'ur' });
    expect(pieces.getEngageablePiece).toHaveBeenCalledWith('parent', 'author');
    expect(pieces.createDraft).toHaveBeenCalledWith('author', { languageCode: 'ur' });
    expect(responses.create).toHaveBeenCalledWith('resp1', 'parent', expect.anything());
    expect(pieceStats.increment).toHaveBeenCalledWith(
      'parent',
      { responses: 1 },
      expect.anything(),
    );
    expect(dto.id).toBe('resp1');
  });

  it('gates the parent on the viewer when listing responses', async () => {
    const { service, pieces } = build();
    const page = await service.listForPiece('parent', 'viewer', undefined, 20);
    expect(pieces.getEngageablePiece).toHaveBeenCalledWith('parent', 'viewer');
    expect(page.items).toEqual([]);
  });
});
