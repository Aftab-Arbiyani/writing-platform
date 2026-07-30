import type { ConfigType } from '@nestjs/config';

import type { trendingConfig } from './config/trending.config';
import type { FeedCacheService } from './feed-cache.service';
import type { CardRow } from './feed.repository';
import { FeedRepository } from './feed.repository';
import { DEFAULT_TRENDING_WEIGHTS } from './scoring/trending-scoring';
import { TrendingService } from './trending.service';

function card(id: string): CardRow {
  return {
    id,
    slug: id,
    title: id,
    subtitle: null,
    featuredQuote: null,
    coverImageKey: null,
    visibility: 'public' as CardRow['visibility'],
    wordCount: 1,
    readingTimeSeconds: 1,
    publishedAt: new Date('2026-07-01T00:00:00.000Z'),
    langCode: 'ur',
    langDirection: 'rtl',
    langNativeName: 'اردو',
    genreSlug: null,
    genreName: null,
    username: 'u',
    penName: null,
    avatarKey: null,
    likesCount: 0,
    clapsCount: 0,
    commentsCount: 0,
    responsesCount: 0,
  };
}

function build(ranking: Array<{ pieceId: string; score: number }>, hydrated: CardRow[]) {
  const feed = {
    computeTrendingRanking: jest.fn().mockResolvedValue(ranking),
    listByIds: jest.fn().mockResolvedValue(hydrated),
  };
  const cache = {
    // Exercise the compute path (cache miss) so the ranking query is covered.
    remember: jest
      .fn()
      .mockImplementation((_k: string, _ttl: number, compute: () => unknown) => compute()),
    invalidateTrending: jest.fn().mockResolvedValue(undefined),
  };
  const config = {
    weights: DEFAULT_TRENDING_WEIGHTS,
    snapshotSize: 200,
    cacheTtlSeconds: 300,
  } as unknown as ConfigType<typeof trendingConfig>;
  const service = new TrendingService(
    feed as unknown as FeedRepository,
    cache as unknown as FeedCacheService,
    config,
  );
  return { service, feed, cache };
}

describe('TrendingService', () => {
  it('computes the ranking with the configured weights + snapshot size', async () => {
    const { service, feed } = build([{ pieceId: 'a', score: 9 }], [card('a')]);
    await service.getFeed(undefined, 20);
    expect(feed.computeTrendingRanking).toHaveBeenCalledWith(DEFAULT_TRENDING_WEIGHTS, 200);
  });

  it('keyset-paginates the cached snapshot and hydrates in ranked order', async () => {
    const ranking = [
      { pieceId: 'a', score: 9 },
      { pieceId: 'b', score: 8 },
      { pieceId: 'c', score: 7 },
    ];
    // listByIds may return rows in any order; the service must restore rank order.
    const { service, feed } = build(ranking, [card('b'), card('a')]);
    const page = await service.getFeed(undefined, 2);
    expect(feed.listByIds).toHaveBeenCalledWith(['a', 'b']);
    expect(page.items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(page.meta.hasMore).toBe(true);
    expect(page.meta.nextCursor).not.toBeNull();
  });

  it('drops pieces that vanished since the snapshot was taken', async () => {
    const ranking = [
      { pieceId: 'a', score: 9 },
      { pieceId: 'b', score: 8 },
    ];
    const { service } = build(ranking, [card('b')]); // 'a' unpublished/deleted since snapshot
    const page = await service.getFeed(undefined, 2);
    expect(page.items.map((i) => i.id)).toEqual(['b']);
  });

  it('invalidates the trending cache on demand', async () => {
    const { service, cache } = build([], []);
    await service.invalidate();
    expect(cache.invalidateTrending).toHaveBeenCalled();
  });
});
