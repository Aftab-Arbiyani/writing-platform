import { MAX_COMMENT_DEPTH, Role } from '@qalam/shared';
import type { EntityManager } from 'typeorm';

import type { TransactionRunner } from '../../common/database/transaction-runner';
import type { DomainEventBus } from '../../common/events/domain-event-bus';
import type { PiecesService } from '../pieces/pieces.service';
import type { ProfileService } from '../users/profile.service';
import type { UsersService } from '../users/users.service';
import { CommentsService } from './comments.service';
import type { CommentsRepository } from './comments.repository';
import { Comment } from './entities/comment.entity';
import type { PieceStatsRepository } from './piece-stats.repository';
import {
  CommentDeletedException,
  CommentDepthExceededException,
  CommentForbiddenException,
  CommentNotFoundException,
} from './exceptions/engagement.exceptions';

const tx = {
  run: (w: (m: EntityManager) => Promise<unknown>) => w({} as EntityManager),
} as unknown as TransactionRunner;

function comment(overrides: Partial<Comment> = {}): Comment {
  return Object.assign(new Comment(), {
    id: 'c1',
    pieceId: 'p1',
    authorId: 'author',
    parentId: null,
    depth: 1,
    body: 'hi',
    editedAt: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

function build(repoOverrides: Partial<Record<string, jest.Mock>> = {}) {
  const comments = {
    create: jest.fn().mockImplementation((data: Partial<Comment>) => comment(data)),
    findById: jest.fn().mockResolvedValue(comment()),
    findByIdWithDeleted: jest.fn().mockResolvedValue(comment()),
    update: jest.fn().mockResolvedValue(undefined),
    softDelete: jest.fn().mockResolvedValue(undefined),
    countRepliesByParents: jest.fn().mockResolvedValue(new Map<string, number>()),
    ...repoOverrides,
  };
  const pieceStats = { increment: jest.fn().mockResolvedValue(undefined) };
  const pieces = { getEngageablePiece: jest.fn().mockResolvedValue({ id: 'p1' }) };
  const users = { findById: jest.fn().mockResolvedValue({ username: 'meera' }) };
  const profiles = {
    getOrCreateByUserId: jest.fn().mockResolvedValue({ penName: 'Meera', avatarKey: null }),
  };
  const service = new CommentsService(
    comments as unknown as CommentsRepository,
    pieceStats as unknown as PieceStatsRepository,
    pieces as unknown as PiecesService,
    users as unknown as UsersService,
    profiles as unknown as ProfileService,
    tx,
    { emit: jest.fn().mockResolvedValue(undefined) } as unknown as DomainEventBus,
  );
  return { service, comments, pieceStats, pieces };
}

describe('CommentsService — create', () => {
  it('creates a top-level comment and bumps comments_count', async () => {
    const { service, comments, pieceStats } = build();
    const dto = await service.create('p1', 'author', { body: 'nice piece' });
    expect(comments.create).toHaveBeenCalledWith(
      expect.objectContaining({ pieceId: 'p1', parentId: null, depth: 1, body: 'nice piece' }),
      expect.anything(),
    );
    expect(pieceStats.increment).toHaveBeenCalledWith('p1', { comments: 1 }, expect.anything());
    expect(dto.author?.penName).toBe('Meera');
    expect(dto.isDeleted).toBe(false);
  });
});

describe('CommentsService — replies', () => {
  it('nests a reply at parent.depth + 1', async () => {
    const { service, comments } = build({
      findByIdWithDeleted: jest.fn().mockResolvedValue(comment({ id: 'c1', depth: 1 })),
    });
    await service.reply('c1', 'author', { body: 'thanks' });
    expect(comments.create).toHaveBeenCalledWith(
      expect.objectContaining({ parentId: 'c1', depth: 2 }),
      expect.anything(),
    );
  });

  it('rejects nesting beyond MAX_COMMENT_DEPTH', async () => {
    const { service } = build({
      findByIdWithDeleted: jest.fn().mockResolvedValue(comment({ depth: MAX_COMMENT_DEPTH })),
    });
    await expect(service.reply('c1', 'author', { body: 'too deep' })).rejects.toBeInstanceOf(
      CommentDepthExceededException,
    );
  });

  it('rejects replying to a deleted comment', async () => {
    const { service } = build({
      findByIdWithDeleted: jest.fn().mockResolvedValue(comment({ deletedAt: new Date() })),
    });
    await expect(service.reply('c1', 'author', { body: 'hi' })).rejects.toBeInstanceOf(
      CommentDeletedException,
    );
  });

  it('404s replying to a missing comment', async () => {
    const { service } = build({ findByIdWithDeleted: jest.fn().mockResolvedValue(null) });
    await expect(service.reply('nope', 'author', { body: 'hi' })).rejects.toBeInstanceOf(
      CommentNotFoundException,
    );
  });
});

describe('CommentsService — edit', () => {
  it('lets the owner edit and stamps edited_at', async () => {
    const { service, comments } = build();
    const dto = await service.update('c1', 'author', { body: 'edited' });
    const patch = comments.update.mock.calls[0]?.[1] as Partial<Comment>;
    expect(patch.body).toBe('edited');
    expect(patch.editedAt).toBeInstanceOf(Date);
    expect(dto.editedAt).not.toBeNull();
  });

  it('forbids a non-owner from editing', async () => {
    const { service } = build();
    await expect(service.update('c1', 'stranger', { body: 'hijack' })).rejects.toBeInstanceOf(
      CommentForbiddenException,
    );
  });
});

describe('CommentsService — delete', () => {
  it('soft-deletes for the owner', async () => {
    const { service, comments } = build();
    await service.delete('c1', 'author', Role.User);
    expect(comments.softDelete).toHaveBeenCalledWith('c1');
  });

  it('forbids a non-owner, non-moderator', async () => {
    const { service } = build();
    await expect(service.delete('c1', 'stranger', Role.User)).rejects.toBeInstanceOf(
      CommentForbiddenException,
    );
  });

  it('allows a moderator to delete anyone’s comment', async () => {
    const { service, comments } = build();
    await service.delete('c1', 'stranger', Role.Moderator);
    expect(comments.softDelete).toHaveBeenCalledWith('c1');
  });
});
