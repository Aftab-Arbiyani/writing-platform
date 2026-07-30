import { Inject, Injectable, Optional } from '@nestjs/common';
import { AnalyticsPeriod, AnalyticsScope, PieceStatus, TrendType } from '@qalam/shared';
import { createHash } from 'node:crypto';

import { DomainEventBus } from '../../common/events/domain-event-bus';
import { DomainEventType } from '../../common/events/domain-events';
import { QueueRegistry } from '../../infrastructure/queue/queue-registry.service';
import { ModerationService } from '../moderation/moderation.service';
import { PiecesService } from '../pieces/pieces.service';
import {
  ANALYTICS_CACHE_KEYS,
  ANALYTICS_CACHE_TTL,
  DAU_WINDOW_DAYS,
  MAU_WINDOW_DAYS,
  PERIOD_WINDOW_DAYS,
  WAU_WINDOW_DAYS,
} from './analytics.constants';
import { previousRange, resolveRange, type ResolvedRange } from './analytics-range';
import { AnalyticsAggregatorRepository } from './analytics-aggregator.repository';
import { AnalyticsCacheService } from './analytics-cache.service';
import {
  AnalyticsForbiddenException,
  AnalyticsPieceNotFoundException,
} from './analytics.exceptions';
import type { RecordReadDto } from './dto/track.dto';
import type {
  DashboardDto,
  GrowthSeriesDto,
  PieceAnalyticsDto,
  PlatformAnalyticsDto,
  ReaderAnalyticsDto,
  SnapshotResultDto,
  TrendingDto,
  WriterAnalyticsDto,
} from './dto/analytics-response.dto';
import type {
  ContentAnalyticsDto,
  EngagementAnalyticsDto,
  ModerationAnalyticsDto,
  PlatformOverviewDto,
  QueueStatDto,
  SystemAnalyticsDto,
  UserAnalyticsDto,
} from './dto/admin-analytics-response.dto';
import type { AdminAnalyticsQueryDto } from './dto/admin-analytics-query.dto';
import type { TrendingQueryDto, GrowthQueryDto } from './dto/analytics-query.dto';
import { AnalyticsQueryRepository, type RankedRow } from './analytics-query.repository';

const round2 = (value: number): number => Math.round(value * 100) / 100;

type Viewer = { id: string } | null;

const num = (v: string | number | null | undefined): number => Number(v ?? 0);
const rate = (numerator: number, denominator: number): number =>
  denominator > 0 ? numerator / denominator : 0;
const ranked = (rows: RankedRow[]): { key: string; label: string; count: number }[] =>
  rows.map((r) => ({ key: r.key, label: r.label, count: num(r.count) }));

/**
 * The analytics surface (E10). Ingestion emits domain events (the listener
 * aggregates — never write analytics here); reads come exclusively from the
 * aggregate tables / snapshots (fast, bounded), with platform + trending cached.
 * Reuses `PiecesService.getEngageablePiece` to validate + resolve the author for
 * tracked views/reads.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly events: DomainEventBus,
    private readonly pieces: PiecesService,
    private readonly query: AnalyticsQueryRepository,
    private readonly aggregator: AnalyticsAggregatorRepository,
    private readonly cache: AnalyticsCacheService,
    private readonly moderation: ModerationService,
    // QueueRegistry is a @Global infra export ("injectable everywhere"); optional
    // so an API-only/test context without the worker backbone still boots.
    @Optional() @Inject(QueueRegistry) private readonly queues?: QueueRegistry,
  ) {}

  // ── Ingestion (emit events; listener aggregates) ───────────────────────────

  async recordView(pieceId: string, viewer: Viewer, fingerprint: string): Promise<void> {
    const piece = await this.pieces.getEngageablePiece(pieceId, viewer?.id ?? null);
    await this.events.emit(DomainEventType.PieceViewed, {
      pieceId,
      authorId: piece.authorId,
      viewerId: viewer?.id ?? null,
      viewerKey: this.viewerKey(viewer, fingerprint),
      isAuthenticated: viewer !== null,
    });
  }

  async recordRead(pieceId: string, viewer: Viewer, dto: RecordReadDto): Promise<void> {
    const piece = await this.pieces.getEngageablePiece(pieceId, viewer?.id ?? null);
    await this.events.emit(DomainEventType.ReadCompleted, {
      pieceId,
      authorId: piece.authorId,
      readerId: viewer?.id ?? null,
      durationSeconds: dto.durationSeconds,
      completionPct: dto.completionPct,
    });
  }

  private viewerKey(viewer: Viewer, fingerprint: string): string {
    if (viewer !== null) {
      return `u:${viewer.id}`;
    }
    return `a:${createHash('sha256').update(fingerprint).digest('hex').slice(0, 32)}`;
  }

  // ── Writer ─────────────────────────────────────────────────────────────────

  async getWriterAnalytics(userId: string): Promise<WriterAnalyticsDto> {
    const [wa, received, popular] = await Promise.all([
      this.query.getWriterAnalytics(userId),
      this.query.getWriterReceivedEngagement(userId),
      this.query.getWriterMostPopular(userId),
    ]);
    const views = num(wa?.views);
    const reads = num(wa?.reads);
    return {
      totalViews: views,
      uniqueViews: num(wa?.uniqueViews),
      reads,
      completionRate: rate(num(wa?.completedReads), views),
      totalReadSeconds: num(wa?.totalReadSeconds),
      averageReadTimeSeconds: Math.round(rate(num(wa?.totalReadSeconds), reads)),
      followersGained: num(wa?.followersGained),
      piecesPublished: num(wa?.piecesPublished),
      piecesArchived: num(wa?.piecesArchived),
      commentsReceived: received.comments,
      clapsReceived: received.claps,
      bookmarksReceived: received.bookmarks,
      responsesReceived: received.responses,
      mostPopularPiece:
        popular === null
          ? null
          : {
              pieceId: popular.pieceId,
              title: popular.title,
              slug: popular.slug,
              views: num(popular.views),
            },
    };
  }

  // ── Piece (owner-only) ───────────────────────────────────────────────────

  async getPieceAnalytics(pieceId: string, requesterId: string): Promise<PieceAnalyticsDto> {
    const meta = await this.query.getPieceMeta(pieceId);
    if (meta === null) {
      throw new AnalyticsPieceNotFoundException();
    }
    if (meta.authorId !== requesterId) {
      throw new AnalyticsForbiddenException();
    }
    const [pa, eng] = await Promise.all([
      this.query.getPieceAnalytics(pieceId),
      this.query.getPieceEngagement(pieceId),
    ]);
    const views = num(pa?.views);
    const reads = num(pa?.reads);
    return {
      pieceId,
      views,
      uniqueViews: num(pa?.uniqueViews),
      reads,
      completionRate: rate(num(pa?.completedReads), views),
      averageReadTimeSeconds: Math.round(rate(num(pa?.totalReadSeconds), reads)),
      claps: eng.claps,
      comments: eng.comments,
      responses: eng.responses,
      bookmarks: eng.bookmarks,
      shares: num(pa?.sharesInternal) + num(pa?.sharesExternal) + num(pa?.sharesCopyLink),
      readingSources: {
        internal: num(pa?.sharesInternal),
        external: num(pa?.sharesExternal),
        copyLink: num(pa?.sharesCopyLink),
      },
      publishedAt: pa?.publishedAt != null ? new Date(pa.publishedAt).toISOString() : null,
    };
  }

  // ── Reader ─────────────────────────────────────────────────────────────────

  async getReaderAnalytics(userId: string): Promise<ReaderAnalyticsDto> {
    const [ra, genres, languages] = await Promise.all([
      this.query.getReaderAnalytics(userId),
      this.query.readerFavoriteGenres(userId, 5),
      this.query.readerFavoriteLanguages(userId, 5),
    ]);
    return {
      piecesRead: num(ra?.piecesRead),
      readingTimeSeconds: num(ra?.totalReadSeconds),
      completedReads: num(ra?.completedReads),
      currentStreak: num(ra?.currentStreak),
      longestStreak: num(ra?.longestStreak),
      favoriteGenres: ranked(genres),
      favoriteLanguages: ranked(languages),
    };
  }

  async getDashboard(userId: string): Promise<DashboardDto> {
    const [writer, reader] = await Promise.all([
      this.getWriterAnalytics(userId),
      this.getReaderAnalytics(userId),
    ]);
    return { writer, reader };
  }

  // ── Platform (admin) ─────────────────────────────────────────────────────

  async getPlatformAnalytics(): Promise<PlatformAnalyticsDto> {
    return this.cache.remember(ANALYTICS_CACHE_KEYS.platform, ANALYTICS_CACHE_TTL.platform, () =>
      this.computePlatform(),
    );
  }

  private async computePlatform(): Promise<PlatformAnalyticsDto> {
    const [
      counters,
      totalUsers,
      dau,
      mau,
      publishedPieces,
      draftPieces,
      collections,
      newRegistrations,
      topLanguages,
      topGenres,
      topTags,
      topWriters,
    ] = await Promise.all([
      this.query.getPlatformCounters(),
      this.query.countUsers(),
      this.query.countActiveUsers(DAU_WINDOW_DAYS),
      this.query.countActiveUsers(MAU_WINDOW_DAYS),
      this.query.countPiecesByStatus(PieceStatus.Published),
      this.query.countPiecesByStatus(PieceStatus.Draft),
      this.query.countCollections(),
      this.query.countRegistrations(MAU_WINDOW_DAYS),
      this.query.topLanguages(10),
      this.query.topGenres(10),
      this.query.topTags(10),
      this.query.topWriters(10),
    ]);
    return {
      totalUsers,
      dailyActiveUsers: dau,
      monthlyActiveUsers: mau,
      newRegistrations,
      publishedPieces,
      draftPieces,
      collections,
      comments: num(counters?.comments),
      claps: num(counters?.claps),
      bookmarks: num(counters?.bookmarks),
      views: num(counters?.views),
      reads: num(counters?.reads),
      topLanguages: ranked(topLanguages),
      topGenres: ranked(topGenres),
      topTags: ranked(topTags),
      topWriters: ranked(topWriters),
    };
  }

  // ── Trending (cached) ──────────────────────────────────────────────────────

  async getTrending(dto: TrendingQueryDto): Promise<TrendingDto> {
    const key = ANALYTICS_CACHE_KEYS.trending(dto.type ?? 'all', dto.period, dto.limit);
    return this.cache.remember(key, ANALYTICS_CACHE_TTL.trending, () => this.computeTrending(dto));
  }

  private async computeTrending(dto: TrendingQueryDto): Promise<TrendingDto> {
    const days = PERIOD_WINDOW_DAYS[dto.period];
    const want = (t: TrendType): boolean => dto.type === undefined || dto.type === t;
    const [pieces, writers, genres, tags] = await Promise.all([
      want(TrendType.Pieces) ? this.query.trendingPieces(days, dto.limit) : Promise.resolve([]),
      want(TrendType.Writers) ? this.query.trendingWriters(days, dto.limit) : Promise.resolve([]),
      want(TrendType.Genres) ? this.query.trendingGenres(days, dto.limit) : Promise.resolve([]),
      want(TrendType.Tags) ? this.query.trendingTags(days, dto.limit) : Promise.resolve([]),
    ]);
    return {
      period: dto.period,
      pieces: ranked(pieces),
      writers: ranked(writers),
      genres: ranked(genres),
      tags: ranked(tags),
    };
  }

  // ── Growth (from snapshots) ──────────────────────────────────────────────

  async getWriterGrowth(userId: string, dto: GrowthQueryDto): Promise<GrowthSeriesDto> {
    const rows = await this.query.getSnapshots(
      AnalyticsScope.Writer,
      userId,
      dto.period,
      dto.points,
    );
    return { period: dto.period, points: rows.reverse() };
  }

  async getPlatformGrowth(dto: GrowthQueryDto): Promise<GrowthSeriesDto> {
    const rows = await this.query.getSnapshots(
      AnalyticsScope.Platform,
      'global',
      dto.period,
      dto.points,
    );
    return { period: dto.period, points: rows.reverse() };
  }

  // ── Snapshot generation (on demand — no background job) ─────────────────────

  async generateSnapshots(period: AnalyticsPeriod): Promise<SnapshotResultDto> {
    const periodStart = startOfPeriod(period);

    const platform = await this.computePlatform();
    await this.aggregator.upsertSnapshot(AnalyticsScope.Platform, 'global', period, periodStart, {
      totalUsers: platform.totalUsers,
      publishedPieces: platform.publishedPieces,
      views: platform.views,
      reads: platform.reads,
      comments: platform.comments,
      claps: platform.claps,
      bookmarks: platform.bookmarks,
    });

    const writerIds = await this.query.activeWriterIds();
    for (const userId of writerIds) {
      const wa = await this.query.getWriterAnalytics(userId);
      if (wa === null) {
        continue;
      }
      await this.aggregator.upsertSnapshot(AnalyticsScope.Writer, userId, period, periodStart, {
        views: num(wa.views),
        uniqueViews: num(wa.uniqueViews),
        reads: num(wa.reads),
        completedReads: num(wa.completedReads),
        followersGained: num(wa.followersGained),
        piecesPublished: num(wa.piecesPublished),
      });
    }
    return { period, periodStart, snapshotsWritten: 1 + writerIds.length };
  }

  // ── Admin platform analytics (E12.9) ─────────────────────────────────────────

  /** Platform overview — headline counts + period-over-period growth. Cached. */
  getOverview(q: AdminAnalyticsQueryDto): Promise<PlatformOverviewDto> {
    const range = resolveRange(q.range, q.from, q.to);
    return this.cache.remember(
      ANALYTICS_CACHE_KEYS.admin('overview', filterKey(q, range)),
      ANALYTICS_CACHE_TTL.admin,
      () => this.computeOverview(range),
    );
  }

  private async computeOverview(range: ResolvedRange): Promise<PlatformOverviewDto> {
    const prev = previousRange(range);
    const [
      counters,
      totalUsers,
      verified,
      activeUsers,
      privateAccounts,
      published,
      drafts,
      mod,
      newUsers,
      prevNewUsers,
      dbSize,
    ] = await Promise.all([
      this.query.getPlatformCounters(),
      this.query.countUsers(),
      this.query.countVerifiedUsers(),
      this.query.countActiveUsers(MAU_WINDOW_DAYS),
      this.query.countPrivateAccounts(),
      this.query.countPiecesByStatus(PieceStatus.Published),
      this.query.countPiecesByStatus(PieceStatus.Draft),
      this.moderation.getStatistics(),
      this.query.countRegistrationsBetween(range.from, range.to),
      this.query.countRegistrationsBetween(prev.from, prev.to),
      this.query.databaseSizeBytes(),
    ]);
    const reports = mod.openReports + mod.resolvedReports + mod.dismissedReports;
    const growthRatePct =
      prevNewUsers > 0 ? ((newUsers - prevNewUsers) / prevNewUsers) * 100 : newUsers > 0 ? 100 : 0;
    return {
      totalUsers,
      verifiedUsers: verified,
      activeUsers,
      newUsers,
      privateAccounts,
      publishedPieces: published,
      drafts,
      comments: num(counters?.comments),
      responses: num(counters?.responses),
      reports,
      resolvedReports: mod.resolvedReports,
      bookmarks: num(counters?.bookmarks),
      claps: num(counters?.claps),
      followers: num(counters?.follows),
      databaseSizeBytes: dbSize,
      growthRatePct: round2(growthRatePct),
      generatedAt: new Date().toISOString(),
    };
  }

  /** User analytics — registrations, active/retention, DAU/WAU/MAU, breakdowns. Cached. */
  getUserAnalytics(q: AdminAnalyticsQueryDto): Promise<UserAnalyticsDto> {
    const range = resolveRange(q.range, q.from, q.to);
    return this.cache.remember(
      ANALYTICS_CACHE_KEYS.admin('users', filterKey(q, range)),
      ANALYTICS_CACHE_TTL.admin,
      () => this.computeUserAnalytics(q, range),
    );
  }

  private async computeUserAnalytics(
    q: AdminAnalyticsQueryDto,
    range: ResolvedRange,
  ): Promise<UserAnalyticsDto> {
    const [registrations, activeUsers, retention, dau, wau, mau, topLanguages, series] =
      await Promise.all([
        this.query.countRegistrationsBetween(range.from, range.to),
        this.query.countActiveBetween(range.from, range.to),
        this.query.retention(range.from),
        this.query.countActiveUsers(DAU_WINDOW_DAYS),
        this.query.countActiveUsers(WAU_WINDOW_DAYS),
        this.query.countActiveUsers(MAU_WINDOW_DAYS),
        this.query.topLanguages(q.limit),
        this.query.registrationsSeries(range.from, range.to),
      ]);
    return {
      registrations,
      activeUsers,
      retentionPct:
        retention.eligible > 0 ? round2((retention.retained / retention.eligible) * 100) : 0,
      dailyActiveUsers: dau,
      weeklyActiveUsers: wau,
      monthlyActiveUsers: mau,
      // Geo + device are not captured by the tracking model → intentionally empty.
      topCountries: [],
      topLanguages: ranked(topLanguages),
      topDevices: [],
      registrationsSeries: series,
    };
  }

  /** Content analytics — pieces, breakdowns, reading, most viewed/shared. Cached. */
  getContentAnalytics(q: AdminAnalyticsQueryDto): Promise<ContentAnalyticsDto> {
    const range = resolveRange(q.range, q.from, q.to);
    return this.cache.remember(
      ANALYTICS_CACHE_KEYS.admin('content', filterKey(q, range)),
      ANALYTICS_CACHE_TTL.admin,
      () => this.computeContentAnalytics(q),
    );
  }

  private async computeContentAnalytics(q: AdminAnalyticsQueryDto): Promise<ContentAnalyticsDto> {
    const [published, drafts, perLanguage, perGenre, reading, mostViewed, mostShared] =
      await Promise.all([
        this.query.countPiecesByStatus(PieceStatus.Published),
        this.query.countPiecesByStatus(PieceStatus.Draft),
        this.query.topLanguages(q.limit),
        this.query.topGenres(q.limit),
        this.query.readingAggregates(),
        this.query.mostViewedPieces(q.limit, q.language, q.genre),
        this.query.mostSharedPieces(q.limit, q.language, q.genre),
      ]);
    return {
      publishedPieces: published,
      drafts,
      piecesPerLanguage: ranked(perLanguage),
      piecesPerGenre: ranked(perGenre),
      averageReadingSeconds: Math.round(rate(reading.totalReadSeconds, reading.reads)),
      averageCompletionRate: round2(rate(reading.completedReads, reading.views)),
      mostViewedPieces: ranked(mostViewed),
      mostSharedPieces: ranked(mostShared),
    };
  }

  /** Engagement analytics — platform-wide interaction totals. Cached. */
  getEngagementAnalytics(q: AdminAnalyticsQueryDto): Promise<EngagementAnalyticsDto> {
    const range = resolveRange(q.range, q.from, q.to);
    return this.cache.remember(
      ANALYTICS_CACHE_KEYS.admin('engagement', filterKey(q, range)),
      ANALYTICS_CACHE_TTL.admin,
      () => this.computeEngagementAnalytics(),
    );
  }

  private async computeEngagementAnalytics(): Promise<EngagementAnalyticsDto> {
    const [counters, reading] = await Promise.all([
      this.query.getPlatformCounters(),
      this.query.readingAggregates(),
    ]);
    return {
      views: num(counters?.views),
      reads: num(counters?.reads),
      readingSeconds: reading.totalReadSeconds,
      completionRate: round2(rate(reading.completedReads, reading.views)),
      bookmarks: num(counters?.bookmarks),
      claps: num(counters?.claps),
      comments: num(counters?.comments),
      responses: num(counters?.responses),
      shares: num(counters?.shares),
      followersGrowth: num(counters?.follows),
    };
  }

  /** Moderation analytics — reuses the moderation report statistics (E12.7). Cached. */
  getModerationAnalytics(q: AdminAnalyticsQueryDto): Promise<ModerationAnalyticsDto> {
    return this.cache.remember(
      ANALYTICS_CACHE_KEYS.admin('moderation', String(q.limit)),
      ANALYTICS_CACHE_TTL.admin,
      () => this.computeModerationAnalytics(q),
    );
  }

  private async computeModerationAnalytics(
    q: AdminAnalyticsQueryDto,
  ): Promise<ModerationAnalyticsDto> {
    const [mod, appeals] = await Promise.all([
      this.moderation.getStatistics(),
      this.query.countAppeals(),
    ]);
    const topReportReasons = Object.entries(mod.byCategory)
      .map(([key, count]) => ({ key, label: key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, q.limit);
    return {
      openReports: mod.openReports,
      closedReports: mod.resolvedReports + mod.dismissedReports,
      appeals,
      averageResolutionSeconds: mod.avgResolutionSeconds,
      topReportReasons,
      moderatorActivity: mod.moderatorPerformance.map((m) => ({
        key: m.moderatorId,
        label: m.moderatorId.slice(0, 8),
        count: m.resolved,
      })),
    };
  }

  /** System analytics — queues/workers, cache, and DB size. Short-TTL cache. */
  getSystemAnalytics(): Promise<SystemAnalyticsDto> {
    return this.cache.remember(
      ANALYTICS_CACHE_KEYS.admin('system', 'current'),
      ANALYTICS_CACHE_TTL.adminSystem,
      () => this.computeSystemAnalytics(),
    );
  }

  private async computeSystemAnalytics(): Promise<SystemAnalyticsDto> {
    const [cacheStats, dbSize, topTables, queues] = await Promise.all([
      this.cache.systemStats(),
      this.query.databaseSizeBytes(),
      this.query.topTables(10),
      this.collectQueueStats(),
    ]);
    return {
      // Per-node in-memory counters (Prometheus /metrics); not aggregated here.
      apiRequests: null,
      errorRate: null,
      queues,
      activeWorkers: queues.reduce((sum, queue) => sum + queue.active, 0),
      workersEnabled: process.env.WORKERS_ENABLED !== 'false',
      cacheHitRatio: cacheStats.hitRatio,
      cacheKeys: cacheStats.keys,
      cacheMemoryBytes: cacheStats.usedMemoryBytes,
      databaseSizeBytes: dbSize,
      topTables,
      storageNote:
        'Object storage (MinIO) usage is not tracked; databaseSizeBytes is the tracked storage.',
    };
  }

  /** Per-queue depth from the BullMQ registry (empty if the backbone is absent). */
  private async collectQueueStats(): Promise<QueueStatDto[]> {
    if (this.queues === undefined) {
      return [];
    }
    try {
      return await Promise.all(
        this.queues.all().map(async ({ name, queue }) => {
          const counts = await queue.getJobCounts(
            'waiting',
            'active',
            'completed',
            'failed',
            'delayed',
          );
          return {
            name,
            waiting: counts.waiting ?? 0,
            active: counts.active ?? 0,
            completed: counts.completed ?? 0,
            failed: counts.failed ?? 0,
            delayed: counts.delayed ?? 0,
          };
        }),
      );
    } catch {
      return [];
    }
  }

  /** Resolves one export dataset to its section payload (controller serializes). */
  getExportData(q: AdminAnalyticsQueryDto, dataset: string): Promise<unknown> {
    switch (dataset) {
      case 'users':
        return this.getUserAnalytics(q);
      case 'content':
        return this.getContentAnalytics(q);
      case 'engagement':
        return this.getEngagementAnalytics(q);
      case 'moderation':
        return this.getModerationAnalytics(q);
      case 'system':
        return this.getSystemAnalytics();
      case 'overview':
      default:
        return this.getOverview(q);
    }
  }
}

/** Deterministic cache-key fragment for an admin analytics read. */
function filterKey(q: AdminAnalyticsQueryDto, range: ResolvedRange): string {
  return `${range.key}|${q.language ?? ''}|${q.genre ?? ''}|${q.limit}`;
}

/** UTC start-of-period date (YYYY-MM-DD) for snapshot bucketing. */
function startOfPeriod(period: AnalyticsPeriod): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (period === AnalyticsPeriod.Monthly) {
    d.setUTCDate(1);
  } else if (period === AnalyticsPeriod.Weekly) {
    const dow = d.getUTCDay(); // 0=Sun..6=Sat
    d.setUTCDate(d.getUTCDate() - ((dow + 6) % 7)); // back to Monday
  }
  return d.toISOString().slice(0, 10);
}
