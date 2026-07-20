import {
  NotificationType,
  POLICY_ACTIONS,
  PolicyEffect,
  SuggestionStatus,
  Visibility,
} from '@qalam/shared';
import type { PolicyDecision } from '@qalam/shared';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { AuditService } from '../audit/audit.service';
import type { PiecesService } from '../pieces/pieces.service';
import type { PolicyEngineService } from '../policy';
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

function build() {
  const repo = {
    findSuggestionById: jest.fn().mockResolvedValue(null),
    listSuggestionsForStory: jest.fn().mockResolvedValue([]),
    createSuggestion: jest
      .fn()
      .mockImplementation((data: Partial<StorySuggestion>) => Promise.resolve(suggestion(data))),
    saveSuggestion: jest.fn().mockImplementation((e: StorySuggestion) => Promise.resolve(e)),
    withTransaction: jest.fn(<T>(work: (m: unknown) => Promise<T>) => work({})),
  } as unknown as jest.Mocked<CollaborationRepository>;

  const pieces = {
    getStoryContext: jest
      .fn()
      .mockResolvedValue({ authorId: OWNER, visibility: Visibility.Private, isPublished: false }),
    // Current story text still contains the suggestion's originalText → no conflict.
    getById: jest.fn().mockResolvedValue({ content: docWith('here is the original text') }),
  } as unknown as jest.Mocked<PiecesService>;

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

  const service = new SuggestionService(repo, pieces, engine, audit, activity, notifier);
  return { service, repo, pieces, engine, audit, activity, notifier };
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

    it('throws SUGGESTION_CONFLICT when the story text no longer contains originalText', async () => {
      const { service, repo, pieces } = build();
      repo.findSuggestionById.mockResolvedValue(suggestion());
      pieces.getById.mockResolvedValue({
        content: docWith('the text was rewritten entirely'),
      } as never);

      await expect(service.accept('s-1', user(OWNER))).rejects.toBeInstanceOf(
        SuggestionConflictException,
      );
      expect(repo.saveSuggestion).not.toHaveBeenCalled();
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
