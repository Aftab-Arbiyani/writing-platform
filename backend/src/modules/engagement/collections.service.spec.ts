import type { EntityManager } from 'typeorm';

import type { TransactionRunner } from '../../common/database/transaction-runner';
import type { PiecesService } from '../pieces/pieces.service';
import { CollectionsService } from './collections.service';
import type { CollectionsRepository } from './collections.repository';
import { Collection } from './entities/collection.entity';
import {
  CollectionDefaultImmutableException,
  CollectionNameTakenException,
  CollectionNotFoundException,
  CollectionPieceExistsException,
  CollectionPieceNotFoundException,
} from './exceptions/engagement.exceptions';

const tx = {
  run: (w: (m: EntityManager) => Promise<unknown>) => w({} as EntityManager),
} as unknown as TransactionRunner;

function collection(overrides: Partial<Collection> = {}): Collection {
  return Object.assign(new Collection(), {
    id: 'col1',
    ownerId: 'owner',
    title: 'My List',
    slug: 'my-list',
    description: null,
    coverImageKey: null,
    visibility: 'private',
    isDefault: false,
    piecesCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

function build(repoOverrides: Partial<Record<string, jest.Mock>> = {}) {
  const collections = {
    findByOwnerAndSlug: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((data: Partial<Collection>) => collection(data)),
    findById: jest.fn().mockResolvedValue(collection()),
    findDefault: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue(undefined),
    softDelete: jest.fn().mockResolvedValue(undefined),
    findMembership: jest.fn().mockResolvedValue(null),
    addPiece: jest.fn().mockResolvedValue(undefined),
    removePiece: jest.fn().mockResolvedValue(true),
    incrementPiecesCount: jest.fn().mockResolvedValue(undefined),
    nextPosition: jest.fn().mockResolvedValue(0),
    ...repoOverrides,
  };
  const pieces = { getEngageablePiece: jest.fn().mockResolvedValue({ id: 'p1' }) };
  const service = new CollectionsService(
    collections as unknown as CollectionsRepository,
    pieces as unknown as PiecesService,
    tx,
  );
  return { service, collections, pieces };
}

describe('CollectionsService — create', () => {
  it('slugifies the title and creates a private collection', async () => {
    const { service, collections } = build();
    const dto = await service.create('owner', { title: 'My List' });
    expect(collections.create).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 'owner', slug: 'my-list', isDefault: false }),
    );
    expect(dto.slug).toBe('my-list');
  });

  it('rejects a duplicate collection (same slug for the owner)', async () => {
    const { service } = build({ findByOwnerAndSlug: jest.fn().mockResolvedValue(collection()) });
    await expect(service.create('owner', { title: 'My List' })).rejects.toBeInstanceOf(
      CollectionNameTakenException,
    );
  });
});

describe('CollectionsService — default "Favorites"', () => {
  it('creates the default on first access', async () => {
    const { service, collections } = build();
    await service.getOrCreateDefault('owner');
    expect(collections.create).toHaveBeenCalledWith(
      expect.objectContaining({ isDefault: true, slug: 'favorites' }),
    );
  });

  it('returns the existing default without recreating it', async () => {
    const { service, collections } = build({
      findDefault: jest.fn().mockResolvedValue(collection({ isDefault: true })),
    });
    await service.getOrCreateDefault('owner');
    expect(collections.create).not.toHaveBeenCalled();
  });

  it('refuses to rename the default collection', async () => {
    const { service } = build({
      findById: jest.fn().mockResolvedValue(collection({ isDefault: true, title: 'Favorites' })),
    });
    await expect(service.update('col1', 'owner', { title: 'Renamed' })).rejects.toBeInstanceOf(
      CollectionDefaultImmutableException,
    );
  });

  it('refuses to delete the default collection', async () => {
    const { service } = build({
      findById: jest.fn().mockResolvedValue(collection({ isDefault: true })),
    });
    await expect(service.delete('col1', 'owner')).rejects.toBeInstanceOf(
      CollectionDefaultImmutableException,
    );
  });
});

describe('CollectionsService — ownership', () => {
  it('404s a foreign collection (privacy-preserving)', async () => {
    const { service } = build({
      findById: jest.fn().mockResolvedValue(collection({ ownerId: 'someone-else' })),
    });
    await expect(service.get('col1', 'owner')).rejects.toBeInstanceOf(CollectionNotFoundException);
  });
});

describe('CollectionsService — membership', () => {
  it('adds a piece and bumps pieces_count', async () => {
    const { service, collections } = build();
    await service.addPiece('col1', 'owner', { pieceId: 'p1' });
    expect(collections.addPiece).toHaveBeenCalled();
    expect(collections.incrementPiecesCount).toHaveBeenCalledWith('col1', 1, expect.anything());
  });

  it('rejects adding a piece already in the collection', async () => {
    const { service } = build({ findMembership: jest.fn().mockResolvedValue({ id: 'm1' }) });
    await expect(service.addPiece('col1', 'owner', { pieceId: 'p1' })).rejects.toBeInstanceOf(
      CollectionPieceExistsException,
    );
  });

  it('removes a piece and decrements pieces_count', async () => {
    const { service, collections } = build();
    await service.removePiece('col1', 'owner', 'p1');
    expect(collections.incrementPiecesCount).toHaveBeenCalledWith('col1', -1, expect.anything());
  });

  it('404s removing a piece that is not in the collection', async () => {
    const { service } = build({ removePiece: jest.fn().mockResolvedValue(false) });
    await expect(service.removePiece('col1', 'owner', 'p1')).rejects.toBeInstanceOf(
      CollectionPieceNotFoundException,
    );
  });
});
