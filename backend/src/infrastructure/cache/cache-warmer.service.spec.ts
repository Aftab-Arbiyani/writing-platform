import type { AnalyticsService } from '../../modules/analytics/analytics.service';
import type { DiscoveryService } from '../../modules/feed/discovery.service';
import type { SearchService } from '../../modules/search/search.service';
import type { TrendingService } from '../../modules/feed/trending.service';
import { CacheWarmerService } from './cache-warmer.service';

function build(overrides: Record<string, jest.Mock> = {}) {
  const trending = { recompute: jest.fn().mockResolvedValue(10) };
  const discovery = {
    getWriters: jest.fn().mockResolvedValue({ items: [] }),
    getTrendingTags: jest.fn().mockResolvedValue({ items: [] }),
    getTrendingGenres: jest.fn().mockResolvedValue({ items: [] }),
    getTrendingLanguages: jest.fn().mockResolvedValue({ items: [] }),
  };
  const analytics = {
    getPlatformAnalytics: jest.fn().mockResolvedValue({}),
    getOverview: jest.fn().mockResolvedValue({}),
    getSystemAnalytics: jest.fn().mockResolvedValue({}),
  };
  const search = { trending: jest.fn().mockResolvedValue({}) };
  Object.assign(trending, overrides);
  const service = new CacheWarmerService(
    trending as unknown as TrendingService,
    discovery as unknown as DiscoveryService,
    analytics as unknown as AnalyticsService,
    search as unknown as SearchService,
  );
  return { service, trending, discovery, analytics, search };
}

describe('CacheWarmerService', () => {
  it('warmAll warms every target and reports success', async () => {
    const { service, trending, analytics, search } = build();
    const results = await service.warmAll();
    expect(results).toHaveLength(4);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(trending.recompute).toHaveBeenCalled();
    expect(analytics.getPlatformAnalytics).toHaveBeenCalled();
    expect(search.trending).toHaveBeenCalled();
  });

  it('isolates a failing target: one failure does not abort the rest', async () => {
    const { service } = build({ recompute: jest.fn().mockRejectedValue(new Error('nope')) });
    const results = await service.warmAll();
    const trendingResult = results.find((r) => r.target === 'trending');
    expect(trendingResult?.ok).toBe(false);
    expect(trendingResult?.error).toBe('nope');
    // Other targets still succeeded.
    expect(results.filter((r) => r.ok)).toHaveLength(3);
  });

  it('warm(target) warms a single group', async () => {
    const { service, analytics } = build();
    const result = await service.warm('analytics');
    expect(result).toEqual({ target: 'analytics', ok: true });
    expect(analytics.getPlatformAnalytics).toHaveBeenCalled();
  });
});
