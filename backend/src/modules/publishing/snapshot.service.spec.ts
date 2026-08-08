import { Role, SnapshotReason } from '@qalam/shared';

import type { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { PieceResponseDto } from '../pieces/dto/piece-response.dto';
import type { PiecesService } from '../pieces/pieces.service';
import { SnapshotHistoryLimitedException } from '../monetization/monetization.exceptions';
import type { PolicyEngineService } from '../policy';
import type { StorySnapshot } from './entities/story-snapshot.entity';
import type { StoryContext } from './publishing.mappers';
import type { PublishingRepository } from './publishing.repository';
import type { SnapshotHistoryService } from './snapshot-history.service';
import { SnapshotService } from './snapshot.service';

/**
 * B7 (docs/45 §4.12) wired through the three READ doors of `SnapshotService`, and kept out of the
 * write.
 *
 * ## What this file exists to stop
 *
 * 1. **Capture acquiring a plan check.** `SuggestionService.accept` captures a `pre_edit` version
 *    inside the transaction that settles the suggestion (`f6827e0`), so a refusal on the write path
 *    does not surface as an upsell — it makes **accepting a suggestion fail** for a free author.
 *    A monetization limit would have become a correctness bug in the collaboration flow. The
 *    history service is stubbed to THROW here, so any capture that consults it fails these tests.
 * 2. **A clamp on the list alone.** `GET /snapshots/:id` and revert are reached by id, so clamping
 *    the list would only hide the ids from someone who does not already have one — the unenforced
 *    gate shape docs/48 §5.2 catalogues seven instances of. Revert most of all: it is the reason a
 *    version history exists.
 * 3. **Reading the actor's plan instead of the owner's.** Asserted on the ARGUMENT, not the result.
 */

const STORY_ID = 'story-1';
const OWNER_ID = 'owner-1';
/** A collaborator on someone else's story — whatever they pay, the OWNER's plan governs. */
const ACTOR: AuthenticatedUser = { id: 'collaborator-9', role: Role.User } as AuthenticatedUser;
const CTX: StoryContext = {
  authorId: OWNER_ID,
  visibility: 'public',
  isPublished: true,
} as unknown as StoryContext;

const PIECE = {
  title: 'A story',
  content: { type: 'doc' },
  wordCount: 12,
} as unknown as PieceResponseDto;

function snapshotRow(version: number, storyId = STORY_ID): StorySnapshot {
  return {
    id: `snap-${String(version)}`,
    storyId,
    version,
    title: `v${String(version)}`,
    content: { type: 'doc', version },
    wordCount: version,
    reason: SnapshotReason.Manual,
    createdById: OWNER_ID,
    createdAt: new Date('2026-08-08T00:00:00.000Z'),
  } as unknown as StorySnapshot;
}

/** Eight stored versions with a pruning gap, newest first. */
const STORED = [12, 11, 9, 6, 5, 3, 2, 1].map((v) => snapshotRow(v));

interface WindowShape {
  limit: number;
  unlimited: boolean;
  total: number;
  visible: number;
  hidden: number;
  cutoffVersion: number | null;
}

/** The window a Free owner gets over {@link STORED}: five visible, floor at version 5. */
const FREE_WINDOW: WindowShape = {
  limit: 5,
  unlimited: false,
  total: 8,
  visible: 5,
  hidden: 3,
  cutoffVersion: 5,
};

const UNLIMITED_WINDOW: WindowShape = {
  limit: 0,
  unlimited: true,
  total: 8,
  visible: 8,
  hidden: 0,
  cutoffVersion: null,
};

function build(window: WindowShape = FREE_WINDOW) {
  const preview = jest.fn().mockResolvedValue(PIECE);
  const getStoryContext = jest.fn().mockResolvedValue(CTX);
  const update = jest.fn().mockResolvedValue(PIECE);
  const pieces = { preview, getStoryContext, update } as unknown as PiecesService;

  const assert = jest.fn().mockResolvedValue(undefined);
  const engine = { assert } as unknown as PolicyEngineService;
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;

  const listSnapshots = jest
    .fn()
    .mockImplementation((_: string, take?: number) =>
      Promise.resolve(take === undefined ? STORED : STORED.slice(0, take)),
    );
  const findSnapshotById = jest
    .fn()
    .mockImplementation((id: string) => Promise.resolve(STORED.find((s) => s.id === id) ?? null));
  const repo = {
    listSnapshots,
    findSnapshotById,
    nextSnapshotVersion: jest.fn().mockResolvedValue(13),
    createSnapshot: jest
      .fn()
      .mockImplementation((input: { version: number }) =>
        Promise.resolve(snapshotRow(input.version)),
      ),
    pruneSnapshots: jest.fn().mockResolvedValue(0),
    recordEvent: jest.fn().mockResolvedValue(undefined),
  } as unknown as PublishingRepository;

  const windowFn = jest.fn().mockResolvedValue(window);
  const assertVisible = jest.fn().mockImplementation((_s: string, _o: string, version: number) => {
    if (window.cutoffVersion !== null && version < window.cutoffVersion) {
      throw new SnapshotHistoryLimitedException(version, window.limit);
    }
    return Promise.resolve(undefined);
  });
  const history = { window: windowFn, assertVisible } as unknown as SnapshotHistoryService;

  return {
    service: new SnapshotService(pieces, engine, audit, repo, history),
    listSnapshots,
    findSnapshotById,
    update,
    assert,
    windowFn,
    assertVisible,
  };
}

/** A history service that fails loudly if it is consulted at all — the capture-path guard. */
function forbiddenHistory(): SnapshotHistoryService {
  return {
    window: jest.fn(() => {
      throw new Error('capture must not resolve a plan window');
    }),
    assertVisible: jest.fn(() => {
      throw new Error('capture must not be plan-gated');
    }),
  } as unknown as SnapshotHistoryService;
}

describe('SnapshotService.list — the read-time clamp', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns 5 items AND the true total of 8 for a free owner', async () => {
    const t = build();

    const history = await t.service.list(STORY_ID, ACTOR);

    expect(history.items).toHaveLength(5);
    expect(history.items.map((s) => s.version)).toEqual([12, 11, 9, 6, 5]);
    // The whole point of the row: the client can say "5 of 8 versions", not "8 versions" and not
    // "5 versions". Losing `total` makes the upsell dishonest and the hidden versions invisible.
    expect(history.total).toBe(8);
    expect(history.visible).toBe(5);
    expect(history.hidden).toBe(3);
    expect(history.limit).toBe(5);
    expect(history.unlimited).toBe(false);
  });

  it('clamps in the query rather than after it — hidden bodies are never loaded', async () => {
    const t = build();

    await t.service.list(STORY_ID, ACTOR);

    // A snapshot row carries the whole story body; fetching 8 to show 5 would read the hidden
    // versions into memory on every list.
    expect(t.listSnapshots).toHaveBeenCalledWith(STORY_ID, 5);
  });

  it('returns the whole history, unclamped, on an unlimited plan', async () => {
    const t = build(UNLIMITED_WINDOW);

    const history = await t.service.list(STORY_ID, ACTOR);

    expect(t.listSnapshots).toHaveBeenCalledWith(STORY_ID, undefined);
    expect(history.items).toHaveLength(8);
    expect(history.total).toBe(8);
    expect(history.hidden).toBe(0);
    expect(history.unlimited).toBe(true);
  });

  it('resolves the depth from the story OWNER, not the collaborator reading it', async () => {
    const t = build();

    await t.service.list(STORY_ID, ACTOR);

    expect(t.windowFn).toHaveBeenCalledWith(STORY_ID, OWNER_ID);
    expect(t.windowFn).not.toHaveBeenCalledWith(STORY_ID, ACTOR.id);
  });

  it('upgrading restores the older versions retroactively — the same rows, unclamped', async () => {
    const free = await build().service.list(STORY_ID, ACTOR);
    const upgraded = await build(UNLIMITED_WINDOW).service.list(STORY_ID, ACTOR);

    // Nothing was deleted between the two reads; only the owner's plan changed.
    expect(free.items).toHaveLength(5);
    expect(upgraded.items).toHaveLength(8);
    expect(upgraded.items.map((s) => s.version)).toEqual([12, 11, 9, 6, 5, 3, 2, 1]);
    expect(free.total).toBe(upgraded.total);
  });
});

describe('SnapshotService.get — refusing a hidden version by id', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns a version inside the window', async () => {
    const t = build();

    await expect(t.service.get('snap-5', ACTOR)).resolves.toMatchObject({ version: 5 });
  });

  it('REFUSES a version outside the window, even holding a valid id', async () => {
    const t = build();

    // The id is real and the policy engine allows the read; only the plan stands in the way.
    await expect(t.service.get('snap-3', ACTOR)).rejects.toBeInstanceOf(
      SnapshotHistoryLimitedException,
    );
    expect(t.assertVisible).toHaveBeenCalledWith(STORY_ID, OWNER_ID, 3);
  });

  it('returns a hidden version once the plan is unlimited', async () => {
    const t = build(UNLIMITED_WINDOW);

    await expect(t.service.get('snap-1', ACTOR)).resolves.toMatchObject({ version: 1 });
  });
});

describe('SnapshotService.revert — the door that matters most', () => {
  afterEach(() => jest.clearAllMocks());

  it('reverts to a version inside the window', async () => {
    const t = build();

    await t.service.revert(STORY_ID, 'snap-6', ACTOR);

    expect(t.update).toHaveBeenCalledWith(STORY_ID, OWNER_ID, {
      content: { type: 'doc', version: 6 },
    });
  });

  it('REFUSES to revert to a version outside the window, and does not touch the piece', async () => {
    const t = build();

    await expect(t.service.revert(STORY_ID, 'snap-2', ACTOR)).rejects.toBeInstanceOf(
      SnapshotHistoryLimitedException,
    );
    // Reachability, not wire shape: the refusal has to happen BEFORE the content is written back.
    expect(t.update).not.toHaveBeenCalled();
  });

  it('checks the OWNER’s plan for the revert too', async () => {
    const t = build();

    await t.service.revert(STORY_ID, 'snap-11', ACTOR);

    expect(t.assertVisible).toHaveBeenCalledWith(STORY_ID, OWNER_ID, 11);
  });

  it('reverts to an old version once the plan is unlimited', async () => {
    const t = build(UNLIMITED_WINDOW);

    await t.service.revert(STORY_ID, 'snap-1', ACTOR);

    expect(t.update).toHaveBeenCalledWith(STORY_ID, OWNER_ID, {
      content: { type: 'doc', version: 1 },
    });
  });
});

describe('SnapshotService — capture is NEVER blocked on a plan limit', () => {
  afterEach(() => jest.clearAllMocks());

  /**
   * The regression this row can cause. Both entry points are built with a history service that
   * throws on contact, so gating either one fails here rather than in production, on the accept
   * path, for the users least able to work around it.
   */
  function capturing() {
    const pieces = {
      preview: jest.fn().mockResolvedValue(PIECE),
      getStoryContext: jest.fn().mockResolvedValue(CTX),
      update: jest.fn(),
    } as unknown as PiecesService;
    const repo = {
      nextSnapshotVersion: jest.fn().mockResolvedValue(13),
      createSnapshot: jest
        .fn()
        .mockImplementation((input: { version: number; reason: SnapshotReason }) =>
          Promise.resolve({ ...snapshotRow(input.version), reason: input.reason }),
        ),
      pruneSnapshots: jest.fn().mockResolvedValue(0),
      recordEvent: jest.fn().mockResolvedValue(undefined),
    } as unknown as PublishingRepository;
    return new SnapshotService(
      pieces,
      { assert: jest.fn().mockResolvedValue(undefined) } as unknown as PolicyEngineService,
      { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService,
      repo,
      forbiddenHistory(),
    );
  }

  it('POST /stories/:id/snapshots still captures for an author at their limit', async () => {
    const service = capturing();

    const dto = await service.create(STORY_ID, ACTOR, SnapshotReason.Manual);

    expect(dto.version).toBe(13);
  });

  it('the D1 accept path still captures a pre_edit version for a free author', async () => {
    // `SuggestionService.accept` calls exactly this, inside the transaction that settles the
    // suggestion. If it can throw on a plan limit, accepting a suggestion fails.
    const service = capturing();

    const dto = await service.capture(STORY_ID, ACTOR, SnapshotReason.PreEdit);

    expect(dto.version).toBe(13);
    expect(dto.reason).toBe(SnapshotReason.PreEdit);
  });

  it('keeps capturing past the plan depth — the story grows, the window does not', async () => {
    const service = capturing();

    // Free shows 5 of 8 today; this is the 9th, and it is stored like every other.
    await expect(service.create(STORY_ID, ACTOR, SnapshotReason.Manual)).resolves.toMatchObject({
      version: 13,
    });
  });
});
