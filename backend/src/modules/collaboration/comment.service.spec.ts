import {
  CommentKind,
  CommentStatus,
  NotificationType,
  POLICY_ACTIONS,
  PolicyEffect,
  Visibility,
} from '@qalam/shared';
import type { PolicyDecision } from '@qalam/shared';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { AuditService } from '../audit/audit.service';
import type { PiecesService } from '../pieces/pieces.service';
import type { PolicyEngineService } from '../policy';
import type { ActivityService } from './activity.service';
import type { CollaborationNotifier } from './collaboration-notifier.port';
import { CommentService } from './comment.service';
import type { CollaborationRepository } from './collaboration.repository';
import {
  CollabCommentNotFoundException,
  CollabCommentResolvedException,
} from './collaboration.exceptions';
import type { CollaborationComment } from './entities/collaboration-comment.entity';

const OWNER = 'owner-1';
const AUTHOR = 'author-1';
const STORY = '11111111-1111-1111-1111-111111111111';
const MENTIONED = '22222222-2222-2222-2222-222222222222';

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

function comment(overrides?: Partial<CollaborationComment>): CollaborationComment {
  return {
    id: 'c-1',
    storyId: STORY,
    authorId: AUTHOR,
    parentId: null,
    kind: CommentKind.General,
    anchor: null,
    body: 'hello',
    status: CommentStatus.Open,
    resolvedById: null,
    mentions: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    ...overrides,
  } as CollaborationComment;
}

function build() {
  const repo = {
    findCommentById: jest.fn().mockResolvedValue(null),
    listRootComments: jest.fn().mockResolvedValue([]),
    listReplies: jest.fn().mockResolvedValue([]),
    createComment: jest
      .fn()
      .mockImplementation((data: Partial<CollaborationComment>) => Promise.resolve(comment(data))),
    saveComment: jest.fn().mockImplementation((e: CollaborationComment) => Promise.resolve(e)),
    softDeleteComment: jest.fn().mockResolvedValue(undefined),
    withTransaction: jest.fn(<T>(work: (m: unknown) => Promise<T>) => work({})),
  } as unknown as jest.Mocked<CollaborationRepository>;

  const pieces = {
    getStoryContext: jest
      .fn()
      .mockResolvedValue({ authorId: OWNER, visibility: Visibility.Private, isPublished: false }),
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

  const service = new CommentService(repo, pieces, engine, audit, activity, notifier);
  return { service, repo, pieces, engine, audit, activity, notifier };
}

describe('CommentService', () => {
  describe('create', () => {
    it('asserts StoryComment, records activity, and notifies the story owner', async () => {
      const { service, engine, activity, notifier } = build();

      await service.create(STORY, user(AUTHOR), { body: 'nice work' });

      expect(engine.assert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: POLICY_ACTIONS.StoryComment,
          resource: expect.objectContaining({ storyId: STORY, storyOwnerId: OWNER }),
        }),
      );
      expect(activity.record).toHaveBeenCalled();
      expect(notifier.notify).toHaveBeenCalledWith(
        expect.objectContaining({ recipientId: OWNER, type: NotificationType.CollabComment }),
      );
    });

    it('extracts @uuid mentions from the body and fans out CommentMention notifications', async () => {
      const { service, repo, notifier } = build();

      await service.create(STORY, user(AUTHOR), { body: `ping @${MENTIONED} please` });

      const created = repo.createComment.mock.calls[0]?.[0] as Partial<CollaborationComment>;
      expect(created.mentions).toContain(MENTIONED);
      expect(notifier.notify).toHaveBeenCalledWith(
        expect.objectContaining({ recipientId: MENTIONED, type: NotificationType.CommentMention }),
      );
    });
  });

  describe('reply', () => {
    it('rejects replying to a resolved thread (COLLAB_COMMENT_RESOLVED)', async () => {
      const { service, repo } = build();
      repo.findCommentById.mockResolvedValue(comment({ status: CommentStatus.Resolved }));
      await expect(service.reply('c-1', user(AUTHOR), { body: 'late' })).rejects.toBeInstanceOf(
        CollabCommentResolvedException,
      );
    });

    it('throws COLLAB_COMMENT_NOT_FOUND for a missing parent', async () => {
      const { service, repo } = build();
      repo.findCommentById.mockResolvedValue(null);
      await expect(service.reply('nope', user(AUTHOR), { body: 'x' })).rejects.toBeInstanceOf(
        CollabCommentNotFoundException,
      );
    });

    it('creates a child comment linked to the parent', async () => {
      const { service, repo } = build();
      repo.findCommentById.mockResolvedValue(comment({ id: 'root-1', authorId: 'other' }));
      await service.reply('root-1', user(AUTHOR), { body: 'agreed' });
      const created = repo.createComment.mock.calls[0]?.[0] as Partial<CollaborationComment>;
      expect(created.parentId).toBe('root-1');
    });
  });

  describe('resolve', () => {
    it('asserts CommentResolve (carrying the comment author as owner) and marks resolved', async () => {
      const { service, repo, engine } = build();
      repo.findCommentById.mockResolvedValue(comment());

      const dto = await service.resolve('c-1', user(OWNER));

      expect(engine.assert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: POLICY_ACTIONS.CommentResolve,
          resource: expect.objectContaining({ type: 'comment', ownerId: AUTHOR }),
        }),
      );
      expect(dto.status).toBe(CommentStatus.Resolved);
      expect(dto.resolvedById).toBe(OWNER);
    });

    it('rejects resolving an already-resolved comment', async () => {
      const { service, repo } = build();
      repo.findCommentById.mockResolvedValue(comment({ status: CommentStatus.Resolved }));
      await expect(service.resolve('c-1', user(OWNER))).rejects.toBeInstanceOf(
        CollabCommentResolvedException,
      );
    });
  });

  describe('delete', () => {
    it('asserts CommentDelete and soft-deletes', async () => {
      const { service, repo, engine } = build();
      repo.findCommentById.mockResolvedValue(comment());
      await service.delete('c-1', user(OWNER));
      expect(engine.assert).toHaveBeenCalledWith(
        expect.objectContaining({ action: POLICY_ACTIONS.CommentDelete }),
      );
      expect(repo.softDeleteComment).toHaveBeenCalledWith('c-1');
    });

    it('throws COLLAB_COMMENT_NOT_FOUND for a missing comment', async () => {
      const { service, repo } = build();
      repo.findCommentById.mockResolvedValue(null);
      await expect(service.delete('nope', user(OWNER))).rejects.toBeInstanceOf(
        CollabCommentNotFoundException,
      );
    });
  });

  describe('getThread', () => {
    it('returns the root plus its replies', async () => {
      const { service, repo } = build();
      repo.findCommentById.mockResolvedValue(comment({ id: 'root-1' }));
      repo.listReplies.mockResolvedValue([comment({ id: 'r-1', parentId: 'root-1' })]);
      const thread = await service.getThread('root-1');
      expect(thread.comment.id).toBe('root-1');
      expect(thread.replies).toHaveLength(1);
    });

    it('rejects a non-root comment id', async () => {
      const { service, repo } = build();
      repo.findCommentById.mockResolvedValue(comment({ id: 'r-1', parentId: 'root-1' }));
      await expect(service.getThread('r-1')).rejects.toBeInstanceOf(CollabCommentNotFoundException);
    });
  });
});
