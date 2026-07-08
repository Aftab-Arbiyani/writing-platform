import { DomainEventBus } from '../../common/events/domain-event-bus';
import { DomainEventType } from '../../common/events/domain-events';
import { AnalyticsListener } from './analytics.listener';
import type { AnalyticsAggregatorRepository } from './analytics-aggregator.repository';
import type { AnalyticsCacheService } from './analytics-cache.service';

function build(overrides: Partial<Record<string, jest.Mock>> = {}) {
  const aggregator = {
    incrementPiece: jest.fn().mockResolvedValue(undefined),
    incrementWriter: jest.fn().mockResolvedValue(undefined),
    incrementPlatform: jest.fn().mockResolvedValue(undefined),
    recordUniqueView: jest.fn().mockResolvedValue(true),
    insertReadEvent: jest.fn().mockResolvedValue(undefined),
    isFirstRead: jest.fn().mockResolvedValue(true),
    upsertReader: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const cache = { claimView: jest.fn().mockResolvedValue(true) };
  const bus = new DomainEventBus();
  const listener = new AnalyticsListener(
    bus,
    aggregator as unknown as AnalyticsAggregatorRepository,
    cache as unknown as AnalyticsCacheService,
  );
  listener.onModuleInit();
  return { bus, aggregator, cache };
}

describe('AnalyticsListener', () => {
  describe('PieceViewed', () => {
    it('counts a fresh, unique view across piece/writer/platform', async () => {
      const { bus, aggregator } = build();
      await bus.emit(DomainEventType.PieceViewed, {
        pieceId: 'p1',
        authorId: 'a1',
        viewerId: 'v1',
        viewerKey: 'u:v1',
        isAuthenticated: true,
      });
      expect(aggregator.incrementPiece).toHaveBeenCalledWith('p1', 'a1', {
        views: 1,
        uniqueViews: 1,
      });
      expect(aggregator.incrementWriter).toHaveBeenCalledWith('a1', { views: 1, uniqueViews: 1 });
      expect(aggregator.incrementPlatform).toHaveBeenCalledWith({ views: 1, uniqueViews: 1 });
    });

    it('does not count within the cooldown window', async () => {
      const { bus, aggregator, cache } = build();
      cache.claimView.mockResolvedValue(false);
      await bus.emit(DomainEventType.PieceViewed, {
        pieceId: 'p1',
        authorId: 'a1',
        viewerId: null,
        viewerKey: 'a:x',
        isAuthenticated: false,
      });
      expect(aggregator.incrementPiece).not.toHaveBeenCalled();
    });

    it('counts a repeat viewer as a non-unique view', async () => {
      const { bus, aggregator } = build({ recordUniqueView: jest.fn().mockResolvedValue(false) });
      await bus.emit(DomainEventType.PieceViewed, {
        pieceId: 'p1',
        authorId: 'a1',
        viewerId: 'v1',
        viewerKey: 'u:v1',
        isAuthenticated: true,
      });
      expect(aggregator.incrementPiece).toHaveBeenCalledWith('p1', 'a1', {
        views: 1,
        uniqueViews: 0,
      });
    });
  });

  describe('ReadCompleted', () => {
    it('marks a read completed when past both thresholds + updates the reader', async () => {
      const { bus, aggregator } = build();
      await bus.emit(DomainEventType.ReadCompleted, {
        pieceId: 'p1',
        authorId: 'a1',
        readerId: 'r1',
        durationSeconds: 90,
        completionPct: 80,
      });
      expect(aggregator.incrementPiece).toHaveBeenCalledWith('p1', 'a1', {
        reads: 1,
        totalReadSeconds: 90,
        completedReads: 1,
      });
      expect(aggregator.upsertReader).toHaveBeenCalledWith(
        'r1',
        { piecesRead: 1, reads: 1, totalReadSeconds: 90, completedReads: 1 },
        expect.any(String),
      );
    });

    it('does not mark completed below the thresholds', async () => {
      const { bus, aggregator } = build();
      await bus.emit(DomainEventType.ReadCompleted, {
        pieceId: 'p1',
        authorId: 'a1',
        readerId: null,
        durationSeconds: 10,
        completionPct: 20,
      });
      expect(aggregator.incrementPiece).toHaveBeenCalledWith('p1', 'a1', {
        reads: 1,
        totalReadSeconds: 10,
        completedReads: 0,
      });
      expect(aggregator.upsertReader).not.toHaveBeenCalled(); // anonymous
    });
  });

  describe('other events', () => {
    it('records a share into the right channel bucket', async () => {
      const { bus, aggregator } = build();
      await bus.emit(DomainEventType.ShareCreated, {
        pieceId: 'p1',
        pieceAuthorId: 'a1',
        actorId: null,
        channel: 'external',
      });
      expect(aggregator.incrementPiece).toHaveBeenCalledWith('p1', 'a1', {
        sharesInternal: 0,
        sharesExternal: 1,
        sharesCopyLink: 0,
      });
      expect(aggregator.incrementPlatform).toHaveBeenCalledWith({ shares: 1 });
    });

    it('credits a follower only on an accepted follow', async () => {
      const { bus, aggregator } = build();
      await bus.emit(DomainEventType.UserFollowed, {
        followId: 'f1',
        followerId: 'u1',
        followeeId: 'a1',
        status: 'accepted',
      });
      expect(aggregator.incrementWriter).toHaveBeenCalledWith('a1', { followersGained: 1 });

      aggregator.incrementWriter.mockClear();
      await bus.emit(DomainEventType.UserFollowed, {
        followId: 'f2',
        followerId: 'u2',
        followeeId: 'a1',
        status: 'pending',
      });
      expect(aggregator.incrementWriter).not.toHaveBeenCalled();
    });

    it('counts a publish on writer + platform', async () => {
      const { bus, aggregator } = build();
      await bus.emit(DomainEventType.PiecePublished, { pieceId: 'p1', authorId: 'a1' });
      expect(aggregator.incrementWriter).toHaveBeenCalledWith('a1', { piecesPublished: 1 });
      expect(aggregator.incrementPlatform).toHaveBeenCalledWith({ publishedPieces: 1 });
    });
  });
});
