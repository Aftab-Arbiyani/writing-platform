import { PieceStatus, Visibility } from '@qalam/shared';
import type { EntityManager } from 'typeorm';

import type { TransactionRunner } from '../../common/database/transaction-runner';
import type { DomainEventBus } from '../../common/events/domain-event-bus';
import type { MediaService } from '../../media/media.service';
import type { FollowService } from '../users/follow.service';
import type { ProfileService } from '../users/profile.service';
import type { UsersService } from '../users/users.service';
import type { TaxonomyService } from '../taxonomy/taxonomy.service';
import { Piece } from './entities/piece.entity';
import {
  PieceAlreadyPublishedException,
  PieceForbiddenException,
  PieceIncompleteException,
  PieceInvalidTransitionException,
  PieceNotFoundException,
} from './exceptions/pieces.exceptions';
import { PiecesRepository } from './pieces.repository';
import { PiecesService } from './pieces.service';

const tx = { run: (w: (m: EntityManager) => Promise<unknown>) => w({} as EntityManager) };

function piece(overrides: Partial<Piece> = {}): Piece {
  return Object.assign(new Piece(), {
    id: 'p1',
    authorId: 'author',
    title: 'A Title',
    subtitle: null,
    slug: null,
    content: { type: 'doc', content: [] },
    contentText: 'words here',
    featuredQuote: null,
    coverImageKey: null,
    languageId: 'lang',
    genreId: 'genre',
    status: PieceStatus.Draft,
    visibility: Visibility.Public,
    scheduledAt: null,
    publishedAt: null,
    archivedAt: null,
    wordCount: 2,
    readingTimeSeconds: 1,
    seoMetadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

function build(current: Piece | null): {
  service: PiecesService;
  repo: jest.Mocked<
    Pick<PiecesRepository, 'findById' | 'findBySlug' | 'update' | 'slugExists' | 'getTagIds'>
  >;
  profiles: { adjustPublishedCount: jest.Mock; getOrCreateByUserId: jest.Mock };
} {
  const repo = {
    findById: jest.fn().mockResolvedValue(current),
    findBySlug: jest.fn().mockResolvedValue(current),
    update: jest.fn().mockResolvedValue(undefined),
    slugExists: jest.fn().mockResolvedValue(false),
    getTagIds: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<
    Pick<PiecesRepository, 'findById' | 'findBySlug' | 'update' | 'slugExists' | 'getTagIds'>
  >;
  const profiles = {
    adjustPublishedCount: jest.fn().mockResolvedValue(undefined),
    getOrCreateByUserId: jest.fn().mockResolvedValue({ penName: 'Pen', isPrivate: false }),
  };
  const taxonomy = {
    getLanguage: jest.fn().mockResolvedValue(null),
    getTagsByIds: jest.fn().mockResolvedValue([]),
    getGenresByIds: jest.fn().mockResolvedValue([{ id: 'genre', slug: 'ghazal', name: 'Ghazal' }]),
  };
  const users = { findById: jest.fn().mockResolvedValue({ username: 'meera' }) };
  const follows = { isAcceptedFollower: jest.fn().mockResolvedValue(false) };
  const service = new PiecesService(
    repo as unknown as PiecesRepository,
    taxonomy as unknown as TaxonomyService,
    users as unknown as UsersService,
    profiles as unknown as ProfileService,
    follows as unknown as FollowService,
    {} as MediaService,
    tx as unknown as TransactionRunner,
    { emit: jest.fn().mockResolvedValue(undefined) } as unknown as DomainEventBus,
  );
  return { service, repo, profiles };
}

describe('PiecesService lifecycle', () => {
  it('publishes a draft: generates slug, stamps published_at, bumps piece count', async () => {
    const { service, repo, profiles } = build(piece());
    await service.publish('p1', 'author');
    const patch = repo.update.mock.calls[0]?.[1] as Partial<Piece>;
    expect(patch.status).toBe(PieceStatus.Published);
    expect(patch.slug).toBe('a-title');
    expect(patch.publishedAt).toBeInstanceOf(Date);
    expect(profiles.adjustPublishedCount).toHaveBeenCalledWith('author', 1);
  });

  it('rejects publishing a piece missing required fields (genre/content)', async () => {
    const { service } = build(piece({ genreId: null, wordCount: 0 }));
    await expect(service.publish('p1', 'author')).rejects.toBeInstanceOf(PieceIncompleteException);
  });

  it('rejects publishing an already-published piece', async () => {
    const { service } = build(
      piece({ status: PieceStatus.Published, slug: 'a-title', publishedAt: new Date() }),
    );
    await expect(service.publish('p1', 'author')).rejects.toBeInstanceOf(
      PieceAlreadyPublishedException,
    );
  });

  it('only archives a published piece', async () => {
    const draft = build(piece({ status: PieceStatus.Draft }));
    await expect(draft.service.archive('p1', 'author')).rejects.toBeInstanceOf(
      PieceInvalidTransitionException,
    );
  });

  it('archive → unarchive round-trips the published count', async () => {
    const published = build(
      piece({ status: PieceStatus.Published, slug: 'a-title', publishedAt: new Date() }),
    );
    await published.service.archive('p1', 'author');
    expect(published.profiles.adjustPublishedCount).toHaveBeenCalledWith('author', -1);
  });

  it('enforces owner-only mutation (403 on a visible published piece)', async () => {
    const { service } = build(
      piece({
        authorId: 'someone-else',
        status: PieceStatus.Published,
        slug: 'x',
        publishedAt: new Date(),
      }),
    );
    await expect(service.publish('p1', 'author')).rejects.toBeInstanceOf(PieceForbiddenException);
  });

  it('hides an unpublished piece from a non-owner (404, privacy-preserving)', async () => {
    const { service } = build(piece({ status: PieceStatus.Draft }));
    await expect(service.getById('p1', 'stranger')).rejects.toBeInstanceOf(PieceNotFoundException);
  });

  // ── getBySlug — the web reader's entry point (docs 45 §3). Must be indistinguishable from
  //    getById apart from the lookup key, or the reader surface leaks what the API hides.
  it('reads a published piece by slug', async () => {
    const { service, repo } = build(
      piece({ status: PieceStatus.Published, slug: 'a-title', publishedAt: new Date() }),
    );
    const dto = await service.getBySlug('a-title', null);
    expect(repo.findBySlug).toHaveBeenCalledWith('a-title');
    expect(dto.slug).toBe('a-title');
  });

  it('404s an unknown slug', async () => {
    const { service } = build(null);
    await expect(service.getBySlug('nope', null)).rejects.toBeInstanceOf(PieceNotFoundException);
  });

  it('hides an unpublished piece from a non-owner by slug too (same rule as by id)', async () => {
    const { service } = build(piece({ status: PieceStatus.Draft, slug: 'a-title' }));
    await expect(service.getBySlug('a-title', 'stranger')).rejects.toBeInstanceOf(
      PieceNotFoundException,
    );
  });

  it('lets the owner read their own unpublished piece by slug', async () => {
    const { service } = build(piece({ status: PieceStatus.Draft, slug: 'a-title' }));
    await expect(service.getBySlug('a-title', 'author')).resolves.toMatchObject({
      slug: 'a-title',
    });
  });

  it('hides a private-visibility piece from a stranger by slug', async () => {
    const { service } = build(
      piece({
        status: PieceStatus.Published,
        visibility: Visibility.Private,
        slug: 'a-title',
        publishedAt: new Date(),
      }),
    );
    await expect(service.getBySlug('a-title', 'stranger')).rejects.toBeInstanceOf(
      PieceNotFoundException,
    );
  });

  it('keeps slug immutable across a re-publish (unarchive keeps existing slug/date)', async () => {
    const original = new Date('2026-01-01T00:00:00Z');
    const { service, repo } = build(
      piece({ status: PieceStatus.Archived, slug: 'a-title', publishedAt: original }),
    );
    await service.unarchive('p1', 'author');
    const patch = repo.update.mock.calls[0]?.[1] as Partial<Piece>;
    expect(patch.status).toBe(PieceStatus.Published);
    expect(patch).not.toHaveProperty('slug'); // slug never rewritten
  });
});
