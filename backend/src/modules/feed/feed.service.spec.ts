import { FeedSort } from '@qalam/shared';

import type { TaxonomyService } from '../taxonomy/taxonomy.service';
import type { FeedQueryDto } from './dto/feed-query.dto';
import { FeedService } from './feed.service';
import type { CardRow } from './feed.repository';
import { FeedRepository } from './feed.repository';
import type { TrendingService } from './trending.service';

function cardRow(over: Partial<CardRow> = {}): CardRow {
  return {
    id: 'p1',
    slug: 's',
    title: 't',
    subtitle: null,
    featuredQuote: null,
    coverImageKey: null,
    visibility: 'public' as CardRow['visibility'],
    wordCount: 100,
    readingTimeSeconds: 60,
    publishedAt: new Date('2026-07-01T00:00:00.000Z'),
    langCode: 'ur',
    langDirection: 'rtl',
    langNativeName: 'اردو',
    genreSlug: 'ghazal',
    genreName: 'Ghazal',
    username: 'meera',
    penName: 'Meera',
    avatarKey: null,
    likesCount: 1,
    clapsCount: 2,
    commentsCount: 3,
    responsesCount: 4,
    ...over,
  };
}

function query(over: Partial<FeedQueryDto> = {}): FeedQueryDto {
  return { limit: 20, sort: FeedSort.Latest, ...over } as FeedQueryDto;
}

function build() {
  const feed = {
    listFollowing: jest.fn().mockResolvedValue([cardRow()]),
    listPublic: jest.fn().mockResolvedValue([cardRow()]),
    listDiscover: jest.fn().mockResolvedValue([cardRow()]),
  };
  const taxonomy = {
    resolveLanguageCode: jest.fn().mockResolvedValue('lang-id'),
    resolveGenreSlugs: jest.fn().mockResolvedValue(['g1']),
  };
  const trending = {
    getFeed: jest
      .fn()
      .mockResolvedValue({ items: [], meta: { nextCursor: null, hasMore: false, limit: 20 } }),
  };
  const service = new FeedService(
    feed as unknown as FeedRepository,
    taxonomy as unknown as TaxonomyService,
    trending as unknown as TrendingService,
  );
  return { service, feed, taxonomy, trending };
}

describe('FeedService — latest', () => {
  it('lists public cards and maps them to feed items', async () => {
    const { service, feed } = build();
    const page = await service.getLatest(query());
    expect(feed.listPublic).toHaveBeenCalledWith(FeedSort.Latest, expect.any(Object), null, 20);
    expect(page.items[0]).toMatchObject({
      id: 'p1',
      author: { username: 'meera', penName: 'Meera' },
      stats: { likes: 1, claps: 2, comments: 3, responses: 4 },
      language: { code: 'ur', direction: 'rtl' },
    });
  });

  it('delegates sort=trending to the trending service (no public query)', async () => {
    const { service, feed, trending } = build();
    await service.getLatest(query({ sort: FeedSort.Trending }));
    expect(trending.getFeed).toHaveBeenCalled();
    expect(feed.listPublic).not.toHaveBeenCalled();
  });

  it('resolves language + genre filters via TaxonomyService (multi-value)', async () => {
    const { service, taxonomy, feed } = build();
    await service.getLatest(query({ language: 'hi,ur', genre: 'ghazal' }));
    expect(taxonomy.resolveLanguageCode).toHaveBeenCalledWith('hi');
    expect(taxonomy.resolveLanguageCode).toHaveBeenCalledWith('ur');
    expect(taxonomy.resolveGenreSlugs).toHaveBeenCalledWith(['ghazal']);
    const filters = feed.listPublic.mock.calls[0][1] as {
      languageIds: string[];
      genreIds: string[];
    };
    expect(filters.languageIds).toEqual(['lang-id', 'lang-id']);
    expect(filters.genreIds).toEqual(['g1']);
  });

  it('passes most_clapped through as the sort', async () => {
    const { service, feed } = build();
    await service.getLatest(query({ sort: FeedSort.MostClapped }));
    expect(feed.listPublic).toHaveBeenCalledWith(
      FeedSort.MostClapped,
      expect.any(Object),
      null,
      20,
    );
  });
});

describe('FeedService — following & discover', () => {
  it('queries the following feed for the viewer', async () => {
    const { service, feed } = build();
    await service.getFollowing('viewer-1', query());
    expect(feed.listFollowing).toHaveBeenCalledWith('viewer-1', expect.any(Object), null, 20);
  });

  it('queries the author-diverse discover feed', async () => {
    const { service, feed } = build();
    const page = await service.getDiscover(query());
    expect(feed.listDiscover).toHaveBeenCalledWith(null, 20);
    expect(page.items).toHaveLength(1);
  });
});
