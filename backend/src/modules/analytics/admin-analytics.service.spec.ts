import type { DomainEventBus } from '../../common/events/domain-event-bus';
import type { QueueRegistry } from '../../infrastructure/queue/queue-registry.service';
import type { ModerationService } from '../moderation/moderation.service';
import type { PiecesService } from '../pieces/pieces.service';
import { AnalyticsService } from './analytics.service';
import type { AnalyticsAggregatorRepository } from './analytics-aggregator.repository';
import type { AnalyticsCacheService } from './analytics-cache.service';
import type { AnalyticsQueryRepository } from './analytics-query.repository';
import { AdminAnalyticsQueryDto } from './dto/admin-analytics-query.dto';

const MOD_STATS = {
  openReports: 4,
  resolvedReports: 30,
  dismissedReports: 6,
  avgResolutionSeconds: 1200,
  byStatus: {},
  byCategory: { spam: 10, harassment: 5 },
  bySeverity: {},
  moderatorPerformance: [{ moderatorId: 'mod12345-x', resolved: 8, avgSeconds: 600 }],
};

function buildAdmin(queryOverrides: Record<string, unknown> = {}) {
  const query = {
    getPlatformCounters: jest.fn().mockResolvedValue({
      comments: '3',
      responses: '2',
      bookmarks: '4',
      claps: '5',
      follows: '6',
      views: '100',
      reads: '40',
      shares: '7',
    }),
    countUsers: jest.fn().mockResolvedValue(50),
    countVerifiedUsers: jest.fn().mockResolvedValue(30),
    countActiveUsers: jest.fn((days: number) =>
      Promise.resolve(days === 1 ? 5 : days === 7 ? 12 : 20),
    ),
    countPrivateAccounts: jest.fn().mockResolvedValue(8),
    countPiecesByStatus: jest.fn((status: string) =>
      Promise.resolve(status === 'published' ? 100 : 25),
    ),
    countRegistrationsBetween: jest.fn().mockResolvedValue(20),
    countActiveBetween: jest.fn().mockResolvedValue(15),
    retention: jest.fn().mockResolvedValue({ eligible: 100, retained: 40 }),
    registrationsSeries: jest.fn().mockResolvedValue([{ date: '2026-07-10', count: 5 }]),
    databaseSizeBytes: jest.fn().mockResolvedValue(123456),
    topTables: jest.fn().mockResolvedValue([{ table: 'users', bytes: 999 }]),
    topLanguages: jest.fn().mockResolvedValue([{ key: 'hi', label: 'Hindi', count: 50 }]),
    topGenres: jest.fn().mockResolvedValue([{ key: 'poetry', label: 'Poetry', count: 20 }]),
    readingAggregates: jest
      .fn()
      .mockResolvedValue({ totalReadSeconds: 4000, reads: 100, completedReads: 60, views: 200 }),
    mostViewedPieces: jest.fn().mockResolvedValue([{ key: 'p1', label: 'T', count: 99 }]),
    mostSharedPieces: jest.fn().mockResolvedValue([{ key: 'p2', label: 'S', count: 12 }]),
    countAppeals: jest.fn().mockResolvedValue(3),
    ...queryOverrides,
  };
  const cache = {
    remember: jest.fn((_k: string, _ttl: number, compute: () => Promise<unknown>) => compute()),
    systemStats: jest.fn().mockResolvedValue({ hitRatio: 0.9, usedMemoryBytes: 1000, keys: 50 }),
  };
  const moderation = { getStatistics: jest.fn().mockResolvedValue(MOD_STATS) };
  const queues = {
    all: jest.fn().mockReturnValue([
      {
        name: 'q1',
        queue: {
          getJobCounts: jest
            .fn()
            .mockResolvedValue({ waiting: 1, active: 2, completed: 3, failed: 0, delayed: 0 }),
        },
      },
    ]),
  };
  const service = new AnalyticsService(
    {} as unknown as DomainEventBus,
    {} as unknown as PiecesService,
    query as unknown as AnalyticsQueryRepository,
    {} as unknown as AnalyticsAggregatorRepository,
    cache as unknown as AnalyticsCacheService,
    moderation as unknown as ModerationService,
    queues as unknown as QueueRegistry,
  );
  return { service, query, cache, moderation, queues };
}

const Q = new AdminAnalyticsQueryDto();

describe('AdminAnalytics — overview', () => {
  it('aggregates headline counts and a period-over-period growth rate', async () => {
    const { service, query, cache } = buildAdmin({
      // current registrations 20, previous 10 → +100% growth.
      countRegistrationsBetween: jest.fn().mockResolvedValueOnce(20).mockResolvedValueOnce(10),
    });
    const overview = await service.getOverview(Q);
    expect(overview).toMatchObject({
      totalUsers: 50,
      verifiedUsers: 30,
      activeUsers: 20, // MAU
      newUsers: 20,
      privateAccounts: 8,
      publishedPieces: 100,
      drafts: 25,
      comments: 3,
      responses: 2,
      reports: 40, // 4 + 30 + 6
      resolvedReports: 30,
      bookmarks: 4,
      claps: 5,
      followers: 6,
      databaseSizeBytes: 123456,
      growthRatePct: 100,
    });
    expect(cache.remember).toHaveBeenCalledWith(
      expect.stringContaining('analytics:admin:overview'),
      expect.any(Number),
      expect.any(Function),
    );
    expect(query.getPlatformCounters).toHaveBeenCalled();
  });
});

describe('AdminAnalytics — users', () => {
  it('computes retention, DAU/WAU/MAU, and leaves geo/device empty', async () => {
    const { service } = buildAdmin();
    const users = await service.getUserAnalytics(Q);
    expect(users.retentionPct).toBe(40); // 40 / 100
    expect(users.dailyActiveUsers).toBe(5);
    expect(users.weeklyActiveUsers).toBe(12);
    expect(users.monthlyActiveUsers).toBe(20);
    expect(users.topCountries).toEqual([]);
    expect(users.topDevices).toEqual([]);
    expect(users.topLanguages).toEqual([{ key: 'hi', label: 'Hindi', count: 50 }]);
    expect(users.registrationsSeries).toEqual([{ date: '2026-07-10', count: 5 }]);
  });
});

describe('AdminAnalytics — content', () => {
  it('computes averages and top lists', async () => {
    const { service } = buildAdmin();
    const content = await service.getContentAnalytics(Q);
    expect(content.publishedPieces).toBe(100);
    expect(content.drafts).toBe(25);
    expect(content.averageReadingSeconds).toBe(40); // 4000 / 100
    expect(content.averageCompletionRate).toBe(0.3); // 60 / 200
    expect(content.mostViewedPieces[0]).toEqual({ key: 'p1', label: 'T', count: 99 });
  });
});

describe('AdminAnalytics — engagement', () => {
  it('sums platform interaction totals', async () => {
    const { service } = buildAdmin();
    const eng = await service.getEngagementAnalytics(Q);
    expect(eng).toMatchObject({
      views: 100,
      reads: 40,
      readingSeconds: 4000,
      completionRate: 0.3,
      bookmarks: 4,
      claps: 5,
      comments: 3,
      responses: 2,
      shares: 7,
      followersGrowth: 6,
    });
  });
});

describe('AdminAnalytics — moderation', () => {
  it('reuses report statistics and sorts top reasons', async () => {
    const { service, moderation } = buildAdmin();
    const mod = await service.getModerationAnalytics(Q);
    expect(moderation.getStatistics).toHaveBeenCalled();
    expect(mod.openReports).toBe(4);
    expect(mod.closedReports).toBe(36); // 30 + 6
    expect(mod.appeals).toBe(3);
    expect(mod.averageResolutionSeconds).toBe(1200);
    expect(mod.topReportReasons).toEqual([
      { key: 'spam', label: 'spam', count: 10 },
      { key: 'harassment', label: 'harassment', count: 5 },
    ]);
    expect(mod.moderatorActivity[0]).toEqual({ key: 'mod12345-x', label: 'mod12345', count: 8 });
  });
});

describe('AdminAnalytics — system', () => {
  it('maps queue depths, cache stats, and DB size; API metrics are null', async () => {
    const { service } = buildAdmin();
    const sys = await service.getSystemAnalytics();
    expect(sys.apiRequests).toBeNull();
    expect(sys.errorRate).toBeNull();
    expect(sys.queues).toEqual([
      { name: 'q1', waiting: 1, active: 2, completed: 3, failed: 0, delayed: 0 },
    ]);
    expect(sys.activeWorkers).toBe(2);
    expect(sys.cacheHitRatio).toBe(0.9);
    expect(sys.cacheKeys).toBe(50);
    expect(sys.cacheMemoryBytes).toBe(1000);
    expect(sys.databaseSizeBytes).toBe(123456);
    expect(sys.topTables).toEqual([{ table: 'users', bytes: 999 }]);
  });

  it('degrades queue stats to empty when the backbone is absent', async () => {
    const { query, cache, moderation } = buildAdmin();
    const service = new AnalyticsService(
      {} as unknown as DomainEventBus,
      {} as unknown as PiecesService,
      query as unknown as AnalyticsQueryRepository,
      {} as unknown as AnalyticsAggregatorRepository,
      cache as unknown as AnalyticsCacheService,
      moderation as unknown as ModerationService,
      undefined, // no QueueRegistry
    );
    const sys = await service.getSystemAnalytics();
    expect(sys.queues).toEqual([]);
    expect(sys.activeWorkers).toBe(0);
  });
});

describe('AdminAnalytics — export dispatch', () => {
  it('resolves the requested dataset', async () => {
    const { service } = buildAdmin();
    const data = (await service.getExportData(Q, 'users')) as { registrations: number };
    expect(data.registrations).toBe(20);
  });
});
