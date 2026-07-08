import { AnalyticsPeriod, TrendType } from '@qalam/shared';

import type { DomainEventBus } from '../../common/events/domain-event-bus';
import { DomainEventType } from '../../common/events/domain-events';
import type { PiecesService } from '../pieces/pieces.service';
import { AnalyticsService } from './analytics.service';
import type { AnalyticsAggregatorRepository } from './analytics-aggregator.repository';
import type { AnalyticsCacheService } from './analytics-cache.service';
import type { AnalyticsQueryRepository } from './analytics-query.repository';
import {
  AnalyticsForbiddenException,
  AnalyticsPieceNotFoundException,
} from './analytics.exceptions';
import type { TrendingQueryDto } from './dto/analytics-query.dto';

function build(queryOverrides: Partial<Record<string, jest.Mock>> = {}) {
  const events = { emit: jest.fn().mockResolvedValue(undefined) };
  const pieces = { getEngageablePiece: jest.fn().mockResolvedValue({ id: 'p1', authorId: 'a1' }) };
  const query = {
    getWriterAnalytics: jest.fn().mockResolvedValue(null),
    getWriterReceivedEngagement: jest
      .fn()
      .mockResolvedValue({ claps: 0, comments: 0, bookmarks: 0, responses: 0 }),
    getWriterMostPopular: jest.fn().mockResolvedValue(null),
    getPieceMeta: jest.fn().mockResolvedValue({ authorId: 'a1', title: 'T', slug: 's' }),
    getPieceAnalytics: jest.fn().mockResolvedValue(null),
    getPieceEngagement: jest
      .fn()
      .mockResolvedValue({ claps: 0, comments: 0, bookmarks: 0, responses: 0 }),
    getReaderAnalytics: jest.fn().mockResolvedValue(null),
    readerFavoriteGenres: jest.fn().mockResolvedValue([]),
    readerFavoriteLanguages: jest.fn().mockResolvedValue([]),
    getPlatformCounters: jest.fn().mockResolvedValue({ views: '5', reads: '2', comments: '1' }),
    countUsers: jest.fn().mockResolvedValue(10),
    countActiveUsers: jest.fn().mockResolvedValue(3),
    countPiecesByStatus: jest.fn().mockResolvedValue(4),
    countCollections: jest.fn().mockResolvedValue(2),
    countRegistrations: jest.fn().mockResolvedValue(1),
    topLanguages: jest.fn().mockResolvedValue([]),
    topGenres: jest.fn().mockResolvedValue([]),
    topTags: jest.fn().mockResolvedValue([]),
    topWriters: jest.fn().mockResolvedValue([]),
    trendingPieces: jest.fn().mockResolvedValue([{ key: 'p1', label: 'T', count: 9 }]),
    trendingWriters: jest.fn().mockResolvedValue([]),
    trendingGenres: jest.fn().mockResolvedValue([]),
    trendingTags: jest.fn().mockResolvedValue([]),
    ...queryOverrides,
  };
  const aggregator = { upsertSnapshot: jest.fn().mockResolvedValue(undefined) };
  const cache = {
    remember: jest.fn((_k: string, _ttl: number, compute: () => Promise<unknown>) => compute()),
  };
  const service = new AnalyticsService(
    events as unknown as DomainEventBus,
    pieces as unknown as PiecesService,
    query as unknown as AnalyticsQueryRepository,
    aggregator as unknown as AnalyticsAggregatorRepository,
    cache as unknown as AnalyticsCacheService,
  );
  return { service, events, pieces, query, aggregator, cache };
}

describe('AnalyticsService', () => {
  describe('ingestion', () => {
    it('emits PieceViewed with a user-scoped key for an authenticated viewer', async () => {
      const { service, events } = build();
      await service.recordView('p1', { id: 'v1' }, 'ignored');
      expect(events.emit).toHaveBeenCalledWith(
        DomainEventType.PieceViewed,
        expect.objectContaining({
          pieceId: 'p1',
          authorId: 'a1',
          viewerKey: 'u:v1',
          isAuthenticated: true,
        }),
      );
    });

    it('emits PieceViewed with a hashed anonymous key', async () => {
      const { service, events } = build();
      await service.recordView('p1', null, 'ip|ua');
      const payload = events.emit.mock.calls[0]?.[1] as {
        viewerKey: string;
        isAuthenticated: boolean;
      };
      expect(payload.viewerKey.startsWith('a:')).toBe(true);
      expect(payload.isAuthenticated).toBe(false);
    });

    it('emits ReadCompleted with the reported duration + completion', async () => {
      const { service, events } = build();
      await service.recordRead('p1', { id: 'r1' }, { durationSeconds: 90, completionPct: 80 });
      expect(events.emit).toHaveBeenCalledWith(
        DomainEventType.ReadCompleted,
        expect.objectContaining({ readerId: 'r1', durationSeconds: 90, completionPct: 80 }),
      );
    });
  });

  describe('writer analytics mapping', () => {
    it('computes completion rate + average read time from aggregates', async () => {
      const { service } = build({
        getWriterAnalytics: jest.fn().mockResolvedValue({
          views: '100',
          uniqueViews: '80',
          reads: '40',
          totalReadSeconds: '4000',
          completedReads: '20',
          followersGained: 5,
          piecesPublished: 3,
          piecesArchived: 1,
        }),
        getWriterReceivedEngagement: jest
          .fn()
          .mockResolvedValue({ claps: 12, comments: 4, bookmarks: 7, responses: 2 }),
      });
      const dto = await service.getWriterAnalytics('a1');
      expect(dto.totalViews).toBe(100);
      expect(dto.completionRate).toBe(0.2); // 20 / 100
      expect(dto.averageReadTimeSeconds).toBe(100); // 4000 / 40
      expect(dto.clapsReceived).toBe(12);
    });
  });

  describe('piece analytics authorization', () => {
    it('404s for a missing piece', async () => {
      const { service } = build({ getPieceMeta: jest.fn().mockResolvedValue(null) });
      await expect(service.getPieceAnalytics('p1', 'a1')).rejects.toBeInstanceOf(
        AnalyticsPieceNotFoundException,
      );
    });

    it('403s when the requester is not the author', async () => {
      const { service } = build();
      await expect(service.getPieceAnalytics('p1', 'someone-else')).rejects.toBeInstanceOf(
        AnalyticsForbiddenException,
      );
    });

    it('returns analytics for the owner', async () => {
      const { service } = build({
        getPieceAnalytics: jest.fn().mockResolvedValue({
          views: '50',
          uniqueViews: '40',
          reads: '20',
          totalReadSeconds: '2000',
          completedReads: '10',
          sharesInternal: 2,
          sharesExternal: 1,
          sharesCopyLink: 0,
          publishedAt: new Date('2026-07-01T00:00:00Z'),
        }),
      });
      const dto = await service.getPieceAnalytics('p1', 'a1');
      expect(dto.views).toBe(50);
      expect(dto.shares).toBe(3);
      expect(dto.readingSources).toEqual({ internal: 2, external: 1, copyLink: 0 });
      expect(dto.completionRate).toBe(0.2);
    });
  });

  describe('platform + trending', () => {
    it('reads platform analytics through the cache', async () => {
      const { service, cache } = build();
      const dto = await service.getPlatformAnalytics();
      expect(cache.remember).toHaveBeenCalled();
      expect(dto.totalUsers).toBe(10);
      expect(dto.views).toBe(5);
    });

    it('returns only the requested trend type', async () => {
      const { service, query } = build();
      const dto = await service.getTrending({
        period: AnalyticsPeriod.Weekly,
        type: TrendType.Pieces,
        limit: 10,
      } as TrendingQueryDto);
      expect(query.trendingPieces).toHaveBeenCalled();
      expect(query.trendingWriters).not.toHaveBeenCalled();
      expect(dto.pieces).toHaveLength(1);
    });
  });

  describe('snapshots', () => {
    it('writes a platform snapshot + one per active writer', async () => {
      const { service, aggregator } = build({
        activeWriterIds: jest.fn().mockResolvedValue(['a1', 'a2']),
        getWriterAnalytics: jest.fn().mockResolvedValue({
          views: '1',
          uniqueViews: '1',
          reads: '1',
          totalReadSeconds: '1',
          completedReads: '1',
          followersGained: 0,
          piecesPublished: 1,
          piecesArchived: 0,
        }),
      });
      const result = await service.generateSnapshots(AnalyticsPeriod.Daily);
      expect(result.snapshotsWritten).toBe(3); // platform + 2 writers
      expect(aggregator.upsertSnapshot).toHaveBeenCalledTimes(3);
    });
  });
});
