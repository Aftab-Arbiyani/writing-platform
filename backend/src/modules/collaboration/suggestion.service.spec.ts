import type { EntityManager } from 'typeorm';
import {
  NotificationType,
  POLICY_ACTIONS,
  PolicyEffect,
  SnapshotReason,
  SuggestionStatus,
  Visibility,
} from '@qalam/shared';
import type { PolicyDecision } from '@qalam/shared';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { AuditService } from '../audit/audit.service';
import type { PiecesService } from '../pieces/pieces.service';
import type { PolicyEngineService } from '../policy';
import { SnapshotService } from '../publishing';
import type { PublishingRepository } from '../publishing/publishing.repository';
import type { SnapshotHistoryService } from '../publishing/snapshot-history.service';
import { anchorText } from './content-text.util';
import type { ActivityService } from './activity.service';
import type { CollaborationNotifier } from './collaboration-notifier.port';
import type { CollaborationRepository } from './collaboration.repository';
import {
  SuggestionAlreadyResolvedException,
  SuggestionConflictException,
  SuggestionNotFoundException,
} from './collaboration.exceptions';
import type { StorySuggestion } from './entities/story-suggestion.entity';
import { SuggestionService } from './suggestion.service';

const OWNER = 'owner-1';
const AUTHOR = 'author-1';
const STORY = '11111111-1111-1111-1111-111111111111';

function allow(): PolicyDecision {
  return {
    effect: PolicyEffect.Allow,
    allowed: true,
    reason: 'test-allow',
    matchedRule: 'test',
    obligations: [],
  };
}

function user(id: string): AuthenticatedUser {
  return { id, role: 'user', sessionVersion: 1 };
}

/** A TipTap document whose text is `text` — used to drive conflict detection. */
function docWith(text: string): Record<string, unknown> {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

function suggestion(overrides?: Partial<StorySuggestion>): StorySuggestion {
  return {
    id: 's-1',
    storyId: STORY,
    authorId: AUTHOR,
    anchor: { from: 0, to: 12 },
    originalText: 'the original',
    suggestedText: 'the improved',
    status: SuggestionStatus.Pending,
    resolvedById: null,
    resolvedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as StorySuggestion;
}

/** The transaction the repository hands to `work` — asserted on to prove atomicity. */
const MANAGER = { tag: 'tx' } as unknown as EntityManager;

function build() {
  const repo = {
    findSuggestionById: jest.fn().mockResolvedValue(null),
    listSuggestionsForStory: jest.fn().mockResolvedValue([]),
    createSuggestion: jest
      .fn()
      .mockImplementation((data: Partial<StorySuggestion>) => Promise.resolve(suggestion(data))),
    saveSuggestion: jest.fn().mockImplementation((e: StorySuggestion) => Promise.resolve(e)),
    withTransaction: jest.fn(<T>(work: (m: EntityManager) => Promise<T>) => work(MANAGER)),
  } as unknown as jest.Mocked<CollaborationRepository>;

  const pieces = {
    getStoryContext: jest
      .fn()
      .mockResolvedValue({ authorId: OWNER, visibility: Visibility.Private, isPublished: false }),
    // The text at the suggestion's anchor [0, 12) is still `originalText` → applies.
    getById: jest.fn().mockResolvedValue({ content: docWith('the original text') }),
    replaceContent: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<PiecesService>;

  const snapshots = {
    capture: jest.fn().mockResolvedValue({ id: 'snap-1', version: 1 }),
  } as unknown as jest.Mocked<SnapshotService>;

  const engine = {
    assert: jest.fn().mockResolvedValue(allow()),
  } as unknown as jest.Mocked<PolicyEngineService>;

  const audit = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditService>;
  const activity = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<ActivityService>;
  const notifier = {
    notify: jest.fn().mockResolvedValue(undefined),
  } as jest.Mocked<CollaborationNotifier>;

  const service = new SuggestionService(repo, pieces, engine, audit, activity, snapshots, notifier);
  return { service, repo, pieces, engine, audit, activity, notifier, snapshots };
}

describe('SuggestionService', () => {
  describe('create', () => {
    it('asserts StorySuggest, records activity, and notifies the story owner', async () => {
      const { service, engine, activity, notifier } = build();

      await service.create(STORY, user(AUTHOR), {
        anchor: { from: 0, to: 12 },
        originalText: 'the original',
        suggestedText: 'the improved',
      });

      expect(engine.assert).toHaveBeenCalledWith(
        expect.objectContaining({ action: POLICY_ACTIONS.StorySuggest }),
      );
      expect(activity.record).toHaveBeenCalled();
      expect(notifier.notify).toHaveBeenCalledWith(
        expect.objectContaining({ recipientId: OWNER, type: NotificationType.SuggestionReceived }),
      );
    });
  });

  describe('accept', () => {
    it('asserts SuggestionResolve, passes the conflict check, marks accepted, and notifies the author', async () => {
      const { service, repo, engine, notifier } = build();
      repo.findSuggestionById.mockResolvedValue(suggestion());

      const dto = await service.accept('s-1', user(OWNER));

      expect(engine.assert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: POLICY_ACTIONS.SuggestionResolve,
          resource: expect.objectContaining({ type: 'suggestion', ownerId: AUTHOR }),
        }),
      );
      expect(dto.status).toBe(SuggestionStatus.Accepted);
      expect(dto.resolvedById).toBe(OWNER);
      expect(notifier.notify).toHaveBeenCalledWith(
        expect.objectContaining({ recipientId: AUTHOR, type: NotificationType.SuggestionResolved }),
      );
    });

    it('rewrites the anchored range of the story body to the suggested text', async () => {
      const { service, repo, pieces } = build();
      repo.findSuggestionById.mockResolvedValue(suggestion());

      await service.accept('s-1', user(OWNER));

      expect(pieces.replaceContent).toHaveBeenCalledTimes(1);
      const [pieceId, ownerId, content] = pieces.replaceContent.mock.calls[0]!;
      expect(pieceId).toBe(STORY);
      // Written as the story's true author, not as the accepting collaborator.
      expect(ownerId).toBe(OWNER);
      expect(anchorText(content)).toBe('the improved text');
    });

    it('versions the pre-edit content through the publishing snapshot mechanism', async () => {
      const { service, repo, snapshots } = build();
      repo.findSuggestionById.mockResolvedValue(suggestion());

      await service.accept('s-1', user(OWNER));

      // `capture`, not `create`: the accept path must not be put through a second
      // (publish-level) authorization.
      expect(snapshots.capture).toHaveBeenCalledWith(STORY, user(OWNER), SnapshotReason.PreEdit);
    });

    /**
     * B7's correctness guard, asserted across the two units rather than against a mock (docs/45
     * §4.12). Every other test here stubs `SnapshotService`, so none of them would notice if
     * capture started refusing on a plan limit — and this is the path where that refusal costs the
     * most: the `pre_edit` version is taken as part of settling the suggestion, so a free author at
     * their history depth would simply be unable to ACCEPT one. The real service is wired here with
     * a history service that throws on contact, so a plan check anywhere on the write path fails
     * this test instead of that author.
     */
    it('accepts for an author at their history limit — capture is never plan-gated', async () => {
      const t = build();
      t.repo.findSuggestionById.mockResolvedValue(suggestion());

      const realSnapshots = new SnapshotService(
        {
          preview: jest.fn().mockResolvedValue({ title: 't', content: {}, wordCount: 3 }),
          getStoryContext: jest
            .fn()
            .mockResolvedValue({ authorId: OWNER, visibility: Visibility.Private }),
        } as unknown as PiecesService,
        { assert: jest.fn().mockResolvedValue(allow()) } as unknown as PolicyEngineService,
        { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService,
        {
          nextSnapshotVersion: jest.fn().mockResolvedValue(99),
          createSnapshot: jest.fn().mockResolvedValue({
            id: 'snap-99',
            storyId: STORY,
            version: 99,
            title: 't',
            content: {},
            wordCount: 3,
            reason: SnapshotReason.PreEdit,
            createdById: OWNER,
            createdAt: new Date('2026-08-08T00:00:00Z'),
          }),
          pruneSnapshots: jest.fn().mockResolvedValue(0),
          recordEvent: jest.fn().mockResolvedValue(undefined),
        } as unknown as PublishingRepository,
        {
          window: jest.fn(() => {
            throw new Error('accept must not resolve a plan window');
          }),
          assertVisible: jest.fn(() => {
            throw new Error('accept must not be plan-gated');
          }),
        } as unknown as SnapshotHistoryService,
      );
      const service = new SuggestionService(
        t.repo,
        t.pieces,
        t.engine,
        t.audit,
        t.activity,
        realSnapshots,
        t.notifier,
      );

      const dto = await service.accept('s-1', user(OWNER));

      expect(dto.status).toBe(SuggestionStatus.Accepted);
      expect(t.pieces.replaceContent).toHaveBeenCalled();
    });

    it('applies the rewrite and the resolution in ONE transaction', async () => {
      const { service, repo, pieces, activity } = build();
      repo.findSuggestionById.mockResolvedValue(suggestion());

      await service.accept('s-1', user(OWNER));

      // All three writes get the same manager — a failed apply cannot leave the
      // suggestion marked accepted.
      expect(repo.withTransaction).toHaveBeenCalledTimes(1);
      expect(pieces.replaceContent).toHaveBeenCalledWith(STORY, OWNER, expect.anything(), MANAGER);
      expect(repo.saveSuggestion).toHaveBeenCalledWith(expect.anything(), MANAGER);
      expect(activity.record).toHaveBeenCalledWith(
        STORY,
        OWNER,
        expect.anything(),
        expect.anything(),
        MANAGER,
      );
    });

    it('throws SUGGESTION_CONFLICT when the story text no longer contains originalText', async () => {
      const { service, repo, pieces, snapshots } = build();
      repo.findSuggestionById.mockResolvedValue(suggestion());
      pieces.getById.mockResolvedValue({
        content: docWith('the text was rewritten entirely'),
      } as never);

      await expect(service.accept('s-1', user(OWNER))).rejects.toBeInstanceOf(
        SuggestionConflictException,
      );
      expect(repo.saveSuggestion).not.toHaveBeenCalled();
      expect(pieces.replaceContent).not.toHaveBeenCalled();
      expect(snapshots.capture).not.toHaveBeenCalled();
    });

    it('refuses a STALE ANCHOR even when originalText still occurs elsewhere', async () => {
      const { service, repo, pieces, snapshots } = build();
      repo.findSuggestionById.mockResolvedValue(suggestion());
      // `the original` is still in the document, but no longer at [0, 12) — the
      // passage moved. Relocating the edit would rewrite text nobody agreed to, so
      // this is a conflict, not a best-effort apply.
      pieces.getById.mockResolvedValue({
        content: docWith('a preface, then the original text'),
      } as never);

      await expect(service.accept('s-1', user(OWNER))).rejects.toBeInstanceOf(
        SuggestionConflictException,
      );
      expect(pieces.replaceContent).not.toHaveBeenCalled();
      expect(repo.saveSuggestion).not.toHaveBeenCalled();
      expect(snapshots.capture).not.toHaveBeenCalled();
    });

    it('refuses an anchor whose range no longer fits the document', async () => {
      const { service, repo, pieces } = build();
      repo.findSuggestionById.mockResolvedValue(
        suggestion({ anchor: { from: 0, to: 12 }, originalText: '' }),
      );
      // An empty `originalText` would otherwise match `slice` past the end of the
      // text and apply at a position that does not exist.
      pieces.getById.mockResolvedValue({ content: docWith('short') } as never);

      await expect(service.accept('s-1', user(OWNER))).rejects.toBeInstanceOf(
        SuggestionConflictException,
      );
      expect(pieces.replaceContent).not.toHaveBeenCalled();
    });

    it('rejects accepting a non-pending suggestion (SUGGESTION_ALREADY_RESOLVED)', async () => {
      const { service, repo } = build();
      repo.findSuggestionById.mockResolvedValue(suggestion({ status: SuggestionStatus.Rejected }));
      await expect(service.accept('s-1', user(OWNER))).rejects.toBeInstanceOf(
        SuggestionAlreadyResolvedException,
      );
    });

    it('throws SUGGESTION_NOT_FOUND for a missing suggestion', async () => {
      const { service, repo } = build();
      repo.findSuggestionById.mockResolvedValue(null);
      await expect(service.accept('nope', user(OWNER))).rejects.toBeInstanceOf(
        SuggestionNotFoundException,
      );
    });
  });

  describe('reject', () => {
    it('marks the suggestion rejected and notifies the author', async () => {
      const { service, repo, notifier } = build();
      repo.findSuggestionById.mockResolvedValue(suggestion());
      const dto = await service.reject('s-1', user(OWNER));
      expect(dto.status).toBe(SuggestionStatus.Rejected);
      expect(notifier.notify).toHaveBeenCalledWith(
        expect.objectContaining({ type: NotificationType.SuggestionResolved }),
      );
    });
  });

  describe('withdraw', () => {
    it('asserts SuggestionResolve (self-service) and marks the suggestion withdrawn', async () => {
      const { service, repo, engine } = build();
      repo.findSuggestionById.mockResolvedValue(suggestion());
      const dto = await service.withdraw('s-1', user(AUTHOR));
      expect(engine.assert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: POLICY_ACTIONS.SuggestionResolve,
          resource: expect.objectContaining({ ownerId: AUTHOR }),
        }),
      );
      expect(dto.status).toBe(SuggestionStatus.Withdrawn);
      expect(dto.resolvedById).toBe(AUTHOR);
    });

    it('rejects withdrawing an already-resolved suggestion', async () => {
      const { service, repo } = build();
      repo.findSuggestionById.mockResolvedValue(suggestion({ status: SuggestionStatus.Accepted }));
      await expect(service.withdraw('s-1', user(AUTHOR))).rejects.toBeInstanceOf(
        SuggestionAlreadyResolvedException,
      );
    });
  });
});
