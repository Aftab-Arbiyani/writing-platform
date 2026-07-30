import { Injectable, Logger } from '@nestjs/common';

import { CursorPaginationDto } from '../../common/dto/cursor-pagination.dto';
import { AnalyticsService } from '../../modules/analytics/analytics.service';
import { AdminAnalyticsQueryDto } from '../../modules/analytics/dto/admin-analytics-query.dto';
import { DiscoveryService } from '../../modules/feed/discovery.service';
import { TrendingService } from '../../modules/feed/trending.service';
import { WriterDiscoverQueryDto } from '../../modules/feed/dto/discover-query.dto';
import { SearchService } from '../../modules/search/search.service';
import { TrendingQueryDto } from '../../modules/search/dto/trending-query.dto';
import type { WarmableKey } from './cache.constants';

/** Outcome of one warm target (reported by the admin warm endpoint). */
export interface WarmResult {
  target: WarmableKey;
  ok: boolean;
  error?: string;
}

/**
 * Cache warming — repopulates the hot caches by driving each owning module's
 * *existing* cached read path (no cache logic is duplicated: warming trending
 * calls `TrendingService.recompute()`, which writes the same `feed:trending` key
 * the reader serves). Run proactively on a schedule and on demand via
 * `POST /admin/cache/warm`, so the first real reader after a flush or a cold
 * start hits a warm cache instead of triggering a stampede.
 *
 * Every target is isolated: a failure to warm one cache is logged and reported
 * but never aborts the rest.
 */
@Injectable()
export class CacheWarmerService {
  private readonly logger = new Logger(CacheWarmerService.name);

  constructor(
    private readonly trending: TrendingService,
    private readonly discovery: DiscoveryService,
    private readonly analytics: AnalyticsService,
    private readonly search: SearchService,
  ) {}

  /** Warm every warmable cache; returns a per-target result. */
  async warmAll(): Promise<WarmResult[]> {
    return Promise.all([
      this.run('trending', () => this.trending.recompute()),
      this.run('discovery', () => this.warmDiscovery()),
      this.run('analytics', () => this.warmAnalytics()),
      this.run('search', () => this.search.trending(new TrendingQueryDto()).then(() => undefined)),
    ]);
  }

  /** Warm a single named cache group (used by the targeted refresh job). */
  async warm(target: WarmableKey): Promise<WarmResult> {
    switch (target) {
      case 'trending':
        return this.run('trending', () => this.trending.recompute());
      case 'discovery':
        return this.run('discovery', () => this.warmDiscovery());
      case 'analytics':
        return this.run('analytics', () => this.warmAnalytics());
      case 'search':
        return this.run('search', () =>
          this.search.trending(new TrendingQueryDto()).then(() => undefined),
        );
    }
  }

  /** Repopulate the discovery caches (featured writers + trending taxonomy). */
  private async warmDiscovery(): Promise<void> {
    const page = new CursorPaginationDto();
    await Promise.all([
      this.discovery.getWriters(new WriterDiscoverQueryDto()),
      this.discovery.getTrendingTags(page),
      this.discovery.getTrendingGenres(page),
      this.discovery.getTrendingLanguages(page),
    ]);
  }

  /**
   * Warms the analytics caches by driving the same cached read paths the admin
   * console hits — the writer/reader platform aggregate plus the E12.9 admin
   * overview + system sections (default, unfiltered). No cache logic duplicated.
   */
  private async warmAnalytics(): Promise<void> {
    const query = new AdminAnalyticsQueryDto();
    await Promise.all([
      this.analytics.getPlatformAnalytics(),
      this.analytics.getOverview(query),
      this.analytics.getSystemAnalytics(),
    ]);
  }

  private async run(target: WarmableKey, fn: () => Promise<unknown>): Promise<WarmResult> {
    try {
      await fn();
      return { target, ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'warm failed';
      this.logger.warn(`cache warm "${target}" failed: ${message}`);
      return { target, ok: false, error: message };
    }
  }
}
