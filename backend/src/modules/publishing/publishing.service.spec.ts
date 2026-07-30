import { POLICY_ACTIONS, Role, SnapshotReason, Visibility } from '@qalam/shared';

import type { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { PieceResponseDto } from '../pieces/dto/piece-response.dto';
import { PieceNotFoundException } from '../pieces/exceptions/pieces.exceptions';
import type { PiecesService } from '../pieces/pieces.service';
import type { PolicyEngineService } from '../policy';
import type { StorySnapshot } from './entities/story-snapshot.entity';
import { PublicationNotApprovedException } from './publishing.exceptions';
import type { PublishingRepository } from './publishing.repository';
import { PublishingService } from './publishing.service';
import type { ReviewService } from './review.service';
import { SnapshotService } from './snapshot.service';
import type { StoryContext } from './publishing.mappers';

const STORY_ID = '00000000-0000-0000-0000-000000000001';
const ACTOR: AuthenticatedUser = { id: 'mod-1', role: Role.Moderator, sessionVersion: 1 };
const CTX: StoryContext = {
  authorId: 'author-1',
  visibility: Visibility.Public,
  isPublished: false,
};

const PIECE = { id: STORY_ID, title: 'A story', wordCount: 42 } as unknown as PieceResponseDto;

function build() {
  const getStoryContext = jest.fn().mockResolvedValue(CTX);
  const publish = jest.fn().mockResolvedValue(PIECE);
  const archive = jest.fn().mockResolvedValue(PIECE);
  const schedule = jest.fn().mockResolvedValue(PIECE);
  const update = jest.fn().mockResolvedValue(PIECE);
  const pieces = {
    getStoryContext,
    publish,
    archive,
    schedule,
    update,
  } as unknown as PiecesService;

  const assert = jest.fn().mockResolvedValue(undefined);
  const engine = { assert } as unknown as PolicyEngineService;

  const record = jest.fn().mockResolvedValue(undefined);
  const audit = { record } as unknown as AuditService;

  const hasOpenReview = jest.fn().mockResolvedValue(false);
  const markPublished = jest.fn().mockResolvedValue(undefined);
  const reviews = { hasOpenReview, markPublished } as unknown as ReviewService;

  const createSnapshot = jest.fn().mockResolvedValue(undefined);
  const snapshots = { create: createSnapshot } as unknown as SnapshotService;

  const recordEvent = jest.fn().mockResolvedValue(undefined);
  const listEvents = jest.fn().mockResolvedValue([]);
  const repo = { recordEvent, listEvents } as unknown as PublishingRepository;

  const service = new PublishingService(pieces, engine, audit, reviews, snapshots, repo);
  return {
    service,
    getStoryContext,
    publish,
    update,
    assert,
    record,
    hasOpenReview,
    markPublished,
    createSnapshot,
    recordEvent,
  };
}

describe('PublishingService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('publish', () => {
    it('blocks publish when the story is review-gated and not approved', async () => {
      const t = build();
      t.hasOpenReview.mockResolvedValue(true);

      await expect(t.service.publish(STORY_ID, ACTOR)).rejects.toBeInstanceOf(
        PublicationNotApprovedException,
      );

      expect(t.assert).toHaveBeenCalledWith(
        expect.objectContaining({ action: POLICY_ACTIONS.PublicationPublish }),
      );
      expect(t.publish).not.toHaveBeenCalled();
      expect(t.createSnapshot).not.toHaveBeenCalled();
    });

    it('publishes after approval: snapshots, delegates to pieces, records history', async () => {
      const t = build();
      t.hasOpenReview.mockResolvedValue(false);

      const result = await t.service.publish(STORY_ID, ACTOR);

      expect(result).toBe(PIECE);
      // Snapshot captured with the publish reason BEFORE the state change.
      expect(t.createSnapshot).toHaveBeenCalledWith(STORY_ID, ACTOR, SnapshotReason.Publish);
      // Delegates to the pieces lifecycle with the story's REAL author as owner.
      expect(t.publish).toHaveBeenCalledWith(STORY_ID, CTX.authorId);
      expect(t.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({ storyId: STORY_ID, actorId: ACTOR.id, type: 'published' }),
      );
      expect(t.markPublished).toHaveBeenCalledWith(STORY_ID);
    });

    it('throws PieceNotFound when the story does not exist', async () => {
      const t = build();
      t.getStoryContext.mockResolvedValue(null);

      await expect(t.service.publish(STORY_ID, ACTOR)).rejects.toBeInstanceOf(
        PieceNotFoundException,
      );
      expect(t.assert).not.toHaveBeenCalled();
    });
  });

  describe('changeVisibility', () => {
    it('asserts the change-visibility action and delegates to pieces.update', async () => {
      const t = build();

      await t.service.changeVisibility(STORY_ID, ACTOR, Visibility.Private);

      expect(t.assert).toHaveBeenCalledWith(
        expect.objectContaining({ action: POLICY_ACTIONS.PublicationChangeVisibility }),
      );
      expect(t.update).toHaveBeenCalledWith(STORY_ID, CTX.authorId, {
        visibility: Visibility.Private,
      });
      expect(t.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'visibility_changed' }),
      );
    });
  });
});

// ── SnapshotService: version assignment ─────────────────────────────────────

describe('SnapshotService', () => {
  afterEach(() => jest.clearAllMocks());

  it('captures content at the next per-story version', async () => {
    const preview = jest.fn().mockResolvedValue(PIECE);
    const getStoryContext = jest.fn().mockResolvedValue(CTX);
    const pieces = { preview, getStoryContext } as unknown as PiecesService;

    const engine = {
      assert: jest.fn().mockResolvedValue(undefined),
    } as unknown as PolicyEngineService;
    const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;

    const nextSnapshotVersion = jest.fn().mockResolvedValue(4);
    const createSnapshot = jest.fn().mockImplementation((input: { version: number }) =>
      Promise.resolve({
        id: 'snap-4',
        createdAt: new Date(),
        ...input,
      } as unknown as StorySnapshot),
    );
    const pruneSnapshots = jest.fn().mockResolvedValue(0);
    const recordEvent = jest.fn().mockResolvedValue(undefined);
    const repo = {
      nextSnapshotVersion,
      createSnapshot,
      pruneSnapshots,
      recordEvent,
    } as unknown as PublishingRepository;

    const service = new SnapshotService(pieces, engine, audit, repo);
    const dto = await service.create(STORY_ID, ACTOR, SnapshotReason.Manual);

    expect(nextSnapshotVersion).toHaveBeenCalledWith(STORY_ID);
    expect(createSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ storyId: STORY_ID, version: 4, reason: SnapshotReason.Manual }),
    );
    expect(dto.version).toBe(4);
    expect(pruneSnapshots).toHaveBeenCalled();
  });
});
