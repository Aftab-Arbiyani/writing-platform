import {
  PERMISSIONS,
  POLICY_ACTIONS,
  ReviewDecision,
  ReviewState,
  Role,
  StoryRole,
  TrustLevel,
  TrustStatus,
  Visibility,
} from '@qalam/shared';

import type { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { PermissionResolver } from '../permissions/permission.resolver';
import type { PiecesService } from '../pieces/pieces.service';
import { PolicyCacheService, PolicyEngineService } from '../policy';
import type { ReviewSession } from './entities/review-session.entity';
import {
  ReviewAlreadyRequestedException,
  ReviewInvalidStateException,
  ReviewNotFoundException,
} from './publishing.exceptions';
import type { PublishingRepository } from './publishing.repository';
import { ReviewService } from './review.service';
import type { StoryContext } from './publishing.mappers';

const STORY_ID = '00000000-0000-0000-0000-000000000001';
const REQUESTER: AuthenticatedUser = { id: 'author-1', role: Role.User, sessionVersion: 1 };
const REVIEWER: AuthenticatedUser = { id: 'mod-1', role: Role.Moderator, sessionVersion: 1 };
const CTX: StoryContext = {
  authorId: 'author-1',
  visibility: Visibility.Public,
  isPublished: false,
};

function makeSession(overrides?: Partial<ReviewSession>): ReviewSession {
  return {
    id: 'rev-1',
    storyId: STORY_ID,
    requestedById: 'author-1',
    state: ReviewState.InReview,
    reviewerId: null,
    decision: null,
    notes: null,
    submittedAt: new Date(),
    decidedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as ReviewSession;
}

function build() {
  const getStoryContext = jest.fn().mockResolvedValue(CTX);
  const pieces = { getStoryContext } as unknown as PiecesService;

  const assert = jest.fn().mockResolvedValue(undefined);
  const engine = { assert } as unknown as PolicyEngineService;

  const record = jest.fn().mockResolvedValue(undefined);
  const audit = { record } as unknown as AuditService;

  const findOpenSession = jest.fn().mockResolvedValue(null);
  const findCurrentSession = jest.fn().mockResolvedValue(null);
  const createReviewSession = jest
    .fn()
    .mockImplementation((input: Partial<ReviewSession>) => Promise.resolve(makeSession(input)));
  const saveReviewSession = jest
    .fn()
    .mockImplementation((session: ReviewSession) => Promise.resolve(session));
  const recordEvent = jest.fn().mockResolvedValue(undefined);
  const repo = {
    findOpenSession,
    findCurrentSession,
    createReviewSession,
    saveReviewSession,
    recordEvent,
  } as unknown as PublishingRepository;

  const service = new ReviewService(pieces, engine, audit, repo);
  return {
    service,
    assert,
    findOpenSession,
    findCurrentSession,
    createReviewSession,
    saveReviewSession,
    recordEvent,
  };
}

describe('ReviewService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('request', () => {
    it('creates an in_review session and asserts the review-request action', async () => {
      const t = build();
      t.findOpenSession.mockResolvedValue(null);

      const dto = await t.service.request(STORY_ID, REQUESTER);

      expect(t.assert).toHaveBeenCalledWith(
        expect.objectContaining({ action: POLICY_ACTIONS.ReviewRequest }),
      );
      expect(t.createReviewSession).toHaveBeenCalledWith(
        expect.objectContaining({ state: ReviewState.InReview, requestedById: REQUESTER.id }),
      );
      expect(dto.state).toBe(ReviewState.InReview);
      expect(t.recordEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'submitted' }));
    });

    it('rejects when an open review session already exists', async () => {
      const t = build();
      t.findOpenSession.mockResolvedValue(makeSession());

      await expect(t.service.request(STORY_ID, REQUESTER)).rejects.toBeInstanceOf(
        ReviewAlreadyRequestedException,
      );
      expect(t.createReviewSession).not.toHaveBeenCalled();
    });
  });

  describe('approve', () => {
    it('transitions the current session to approved', async () => {
      const t = build();
      t.findCurrentSession.mockResolvedValue(makeSession({ state: ReviewState.InReview }));

      const dto = await t.service.approve(STORY_ID, REVIEWER);

      expect(t.assert).toHaveBeenCalledWith(
        expect.objectContaining({ action: POLICY_ACTIONS.ReviewApprove }),
      );
      expect(dto.state).toBe(ReviewState.Approved);
      expect(dto.decision).toBe(ReviewDecision.Approve);
      expect(dto.reviewerId).toBe(REVIEWER.id);
      expect(t.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'review_approved' }),
      );
    });

    it('throws when there is no review session', async () => {
      const t = build();
      t.findCurrentSession.mockResolvedValue(null);

      await expect(t.service.approve(STORY_ID, REVIEWER)).rejects.toBeInstanceOf(
        ReviewNotFoundException,
      );
    });

    it('throws when the session is not in a decidable state', async () => {
      const t = build();
      t.findCurrentSession.mockResolvedValue(makeSession({ state: ReviewState.Approved }));

      await expect(t.service.approve(STORY_ID, REVIEWER)).rejects.toBeInstanceOf(
        ReviewInvalidStateException,
      );
    });
  });

  /**
   * Who may decide a review (defect **W3c-1**, docs/48 §3.4). These run the REAL
   * Policy Engine rather than a stubbed `assert`, because the bug was never in the
   * service: the engine allowed the story owner while the route's coarse
   * `@Permissions` gate refused them, so a mocked engine could not see it. Every
   * denial here must come from the Policy Engine — the guard's only job is the
   * `collaboration.use` base gate, which all three of these actors hold.
   */
  describe('reviewer authorization through the Policy Engine (W3c-1)', () => {
    const OWNER: AuthenticatedUser = { id: 'author-1', role: Role.User, sessionVersion: 1 };
    const MEMBER: AuthenticatedUser = { id: 'member-1', role: Role.User, sessionVersion: 1 };
    const STRANGER: AuthenticatedUser = { id: 'stranger-1', role: Role.User, sessionVersion: 1 };

    /** ReviewService wired to a real engine, with the story role the test needs. */
    function buildWithEngine(storyRole: StoryRole | null) {
      const t = build();
      const resolver = {
        resolve: jest.fn(async () => new Set<string>([PERMISSIONS.CollaborationUse])),
      } as unknown as PermissionResolver;
      const engine = new PolicyEngineService(resolver, new PolicyCacheService());
      engine.registerTrustPort({
        getTrustContext: async () => ({
          status: TrustStatus.Normal,
          level: TrustLevel.Member,
          restrictions: [],
        }),
        isInteractionBlocked: async () => false,
      });
      engine.registerMembershipPort({
        getStoryRole: async (_storyId, userId) => (userId === OWNER.id ? null : storyRole),
      });

      const pieces = {
        getStoryContext: jest.fn().mockResolvedValue(CTX),
      } as unknown as PiecesService;
      const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
      const repo = {
        findOpenSession: jest.fn().mockResolvedValue(null),
        findCurrentSession: jest
          .fn()
          .mockResolvedValue(makeSession({ state: ReviewState.InReview })),
        createReviewSession: jest.fn(),
        saveReviewSession: jest
          .fn()
          .mockImplementation((session: ReviewSession) => Promise.resolve(session)),
        recordEvent: jest.fn().mockResolvedValue(undefined),
      } as unknown as PublishingRepository;

      return { service: new ReviewService(pieces, engine, audit, repo), t };
    }

    it('lets the story owner approve, on a plain user role and no story membership', async () => {
      // The case the route used to 403. `CTX.authorId === OWNER.id`, so the
      // ownership rule grants it — no `publishing.approve` anywhere in sight.
      const { service } = buildWithEngine(null);

      const dto = await service.approve(STORY_ID, OWNER);

      expect(dto.state).toBe(ReviewState.Approved);
      expect(dto.reviewerId).toBe(OWNER.id);
    });

    it('lets the story owner request changes on a plain user role', async () => {
      const { service } = buildWithEngine(null);

      const dto = await service.requestChanges(STORY_ID, OWNER, 'Tighten the closing couplet.');

      expect(dto.state).toBe(ReviewState.ChangesRequested);
      expect(dto.notes).toBe('Tighten the closing couplet.');
    });

    it('refuses a member below Editor — from the story-role rule, not the guard', async () => {
      // `ACTION_MIN_STORY_ROLE[review.approve]` is Editor; Reviewer ranks below it.
      // Asserting `matchedRule` is the point: it proves the 403 is the Policy
      // Engine's decision and not the coarse permission gate reappearing.
      const { service } = buildWithEngine(StoryRole.Reviewer);

      await expect(service.approve(STORY_ID, MEMBER)).rejects.toMatchObject({
        code: 'POLICY_DENIED',
        details: [expect.objectContaining({ rule: 'story-role' })],
      });
    });

    it('refuses a member below Editor requesting changes', async () => {
      const { service } = buildWithEngine(StoryRole.BetaReader);

      await expect(service.requestChanges(STORY_ID, MEMBER)).rejects.toMatchObject({
        code: 'POLICY_DENIED',
        details: [expect.objectContaining({ rule: 'story-role' })],
      });
    });

    it('refuses a non-member outright (default-deny)', async () => {
      const { service } = buildWithEngine(null);

      await expect(service.approve(STORY_ID, STRANGER)).rejects.toMatchObject({
        code: 'POLICY_DENIED',
        details: [expect.objectContaining({ rule: 'default-deny' })],
      });
    });

    it('still lets a story Editor approve (the member path AF6 made authoritative)', async () => {
      const { service } = buildWithEngine(StoryRole.Editor);

      const dto = await service.approve(STORY_ID, MEMBER);

      expect(dto.state).toBe(ReviewState.Approved);
      expect(dto.reviewerId).toBe(MEMBER.id);
    });
  });
});
