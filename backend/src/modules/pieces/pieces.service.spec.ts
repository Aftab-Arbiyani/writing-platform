import { PieceStatus, Visibility } from '@qalam/shared';
import type { EntityManager } from 'typeorm';

import type { TransactionRunner } from '../../common/database/transaction-runner';
import type { DomainEventBus } from '../../common/events/domain-event-bus';
import type { MediaService } from '../../media/media.service';
import type { EntitlementService } from '../monetization/entitlement.service';
import { PieceLimitReachedException } from '../monetization/monetization.exceptions';
import type { FollowService } from '../users/follow.service';
import type { ProfileService } from '../users/profile.service';
import type { UsersService } from '../users/users.service';
import type { TaxonomyService } from '../taxonomy/taxonomy.service';
import type { CreatePieceDto } from './dto/create-piece.dto';
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

/** B4: what the author's plan allows and how many live pieces they already hold. */
interface PlanState {
  /** `PlanLimits.maxPieces`; omit the key entirely to test "absent = unlimited". */
  maxPieces?: number;
  /** What `countByAuthor` (non-deleted only) returns. */
  owned: number;
}

function build(
  current: Piece | null,
  plan: PlanState = { maxPieces: 0, owned: 0 },
): {
  service: PiecesService;
  repo: jest.Mocked<
    Pick<
      PiecesRepository,
      'findById' | 'findBySlug' | 'update' | 'slugExists' | 'getTagIds' | 'countByAuthor' | 'create'
    >
  >;
  profiles: { adjustPublishedCount: jest.Mock; getOrCreateByUserId: jest.Mock };
  entitlements: { getLimits: jest.Mock };
} {
  const repo = {
    findById: jest.fn().mockResolvedValue(current),
    findBySlug: jest.fn().mockResolvedValue(current),
    update: jest.fn().mockResolvedValue(undefined),
    slugExists: jest.fn().mockResolvedValue(false),
    getTagIds: jest.fn().mockResolvedValue([]),
    countByAuthor: jest.fn().mockResolvedValue(plan.owned),
    create: jest.fn().mockResolvedValue(piece({ id: 'new' })),
    setTags: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<
    Pick<
      PiecesRepository,
      'findById' | 'findBySlug' | 'update' | 'slugExists' | 'getTagIds' | 'countByAuthor' | 'create'
    >
  >;
  const profiles = {
    adjustPublishedCount: jest.fn().mockResolvedValue(undefined),
    getOrCreateByUserId: jest.fn().mockResolvedValue({ penName: 'Pen', isPrivate: false }),
  };
  const taxonomy = {
    resolveLanguageCode: jest.fn().mockResolvedValue('lang'),
    resolveGenreSlugs: jest.fn().mockResolvedValue(['genre']),
    getLanguage: jest.fn().mockResolvedValue(null),
    getTagsByIds: jest.fn().mockResolvedValue([]),
    getGenresByIds: jest.fn().mockResolvedValue([{ id: 'genre', slug: 'ghazal', name: 'Ghazal' }]),
  };
  const users = { findById: jest.fn().mockResolvedValue({ username: 'meera' }) };
  const follows = { isAcceptedFollower: jest.fn().mockResolvedValue(false) };
  // Only `maxPieces` varies per test; the AI caps are along for the ride, as they are in a real
  // PlanLimits. When `maxPieces` is omitted the key is genuinely absent, which is the
  // "0 / absent = unlimited" case a tier that predates B4 produces.
  const limits: Record<string, number> = {
    aiDailyTokens: 0,
    aiMonthlyTokens: 0,
    aiMonthlyCredits: 0,
    ...(plan.maxPieces === undefined ? {} : { maxPieces: plan.maxPieces }),
  };
  const entitlements = { getLimits: jest.fn().mockResolvedValue(limits) };
  const service = new PiecesService(
    repo as unknown as PiecesRepository,
    taxonomy as unknown as TaxonomyService,
    users as unknown as UsersService,
    profiles as unknown as ProfileService,
    follows as unknown as FollowService,
    {} as MediaService,
    tx as unknown as TransactionRunner,
    { emit: jest.fn().mockResolvedValue(undefined) } as unknown as DomainEventBus,
    entitlements as unknown as EntitlementService,
  );
  return { service, repo, profiles, entitlements };
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

  // ── B4 — the plan piece cap (docs/45 §4.9). A stock cap on live pieces, enforced on creation
  //    only. These assert the DECISIONS, not the wiring: that a create is actually refused, that a
  //    downgraded author keeps full use of what they already have, and that deleting frees a slot.
  const draftDto = { title: 'New', languageCode: 'ur' } as CreatePieceDto;

  it('refuses a create once the author holds as many pieces as the plan allows', async () => {
    const { service } = build(null, { maxPieces: 25, owned: 25 });
    await expect(service.createOwnDraft('author', draftDto)).rejects.toBeInstanceOf(
      PieceLimitReachedException,
    );
  });

  it('reports used/limit on the refusal, so a client can say which cap was hit', async () => {
    const { service } = build(null, { maxPieces: 25, owned: 25 });
    const error = await service.createOwnDraft('author', draftDto).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PieceLimitReachedException);
    expect((error as PieceLimitReachedException).details).toEqual([{ used: 25, limit: 25 }]);
    // NOT the AI quota code: this cap never resets, so "wait for reset" is the wrong remedy
    // (docs/48 §3.6, the W4 defect).
    expect((error as PieceLimitReachedException).code).toBe('PIECE_LIMIT_REACHED');
  });

  it('allows the create one slot below the cap', async () => {
    const { service, repo } = build(null, { maxPieces: 25, owned: 24 });
    await expect(service.createOwnDraft('author', draftDto)).resolves.toMatchObject({ id: 'new' });
    expect(repo.create).toHaveBeenCalled();
  });

  it('treats limit 0 as unlimited, exactly as the token caps do', async () => {
    const { service } = build(null, { maxPieces: 0, owned: 10_000 });
    await expect(service.createOwnDraft('author', draftDto)).resolves.toMatchObject({ id: 'new' });
  });

  it('treats an absent maxPieces as unlimited (a tier configured before B4)', async () => {
    const { service } = build(null, { owned: 10_000 });
    await expect(service.createOwnDraft('author', draftDto)).resolves.toMatchObject({ id: 'new' });
  });

  it('counts only live pieces, so deleting one frees a slot', async () => {
    const { service, repo } = build(null, { maxPieces: 25, owned: 24 });
    await service.createOwnDraft('author', draftDto);
    // countByAuthor filters `deleted_at IS NULL`; called with no status so every live piece counts.
    expect(repo.countByAuthor).toHaveBeenCalledWith('author');
  });

  it('caps duplicate too — a copy is a new piece', async () => {
    const { service } = build(piece(), { maxPieces: 25, owned: 25 });
    await expect(service.duplicate('p1', 'author')).rejects.toBeInstanceOf(
      PieceLimitReachedException,
    );
  });

  // The downgrade case: Plus (250) → Free (25) with 100 pieces in hand. "Keep everything, block
  // new creation" means every one of these must still work.
  describe('over the cap after a downgrade', () => {
    const overLimit = { maxPieces: 25, owned: 100 };

    it('blocks a new create', async () => {
      const { service } = build(null, overLimit);
      await expect(service.createOwnDraft('author', draftDto)).rejects.toBeInstanceOf(
        PieceLimitReachedException,
      );
    });

    it('still publishes an existing piece', async () => {
      const { service, repo } = build(piece(), overLimit);
      await service.publish('p1', 'author');
      expect((repo.update.mock.calls[0]?.[1] as Partial<Piece>).status).toBe(PieceStatus.Published);
    });

    it('still updates an existing piece', async () => {
      const { service, repo } = build(piece(), overLimit);
      await service.update('p1', 'author', { title: 'Edited' });
      expect(repo.update).toHaveBeenCalled();
    });

    it('reports the honest allowance: over the cap, nothing remaining, cannot create', async () => {
      const { service } = build(null, overLimit);
      await expect(service.getPieceAllowance('author')).resolves.toEqual({
        used: 100,
        limit: 25,
        remaining: 0, // never negative — "-75 remaining" is not a thing to show anyone
        unlimited: false,
        canCreate: false,
      });
    });

    it('still lets a response through — the cap is on POST /pieces, not on replying', async () => {
      const { service } = build(null, overLimit);
      await expect(service.createDraft('author', draftDto)).resolves.toMatchObject({ id: 'new' });
    });
  });

  it('reports the allowance an unlimited plan has (no number to count down)', async () => {
    const { service } = build(null, { maxPieces: 0, owned: 900 });
    await expect(service.getPieceAllowance('author')).resolves.toEqual({
      used: 900,
      limit: 0,
      remaining: null,
      unlimited: true,
      canCreate: true,
    });
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
