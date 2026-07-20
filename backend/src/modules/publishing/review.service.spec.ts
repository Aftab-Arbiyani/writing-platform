import { POLICY_ACTIONS, ReviewDecision, ReviewState, Role, Visibility } from '@qalam/shared';

import type { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { PiecesService } from '../pieces/pieces.service';
import type { PolicyEngineService } from '../policy';
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
});
