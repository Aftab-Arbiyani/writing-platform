import { DiscoverPieceKind, FeedSort, WriterKind } from '@qalam/shared';

import { encodeCursor } from '../../common/pagination/cursor.util';
import type { CursorPaginationDto } from '../../common/dto/cursor-pagination.dto';
import { DiscoveryRepository, type WriterCardRow } from './discovery.repository';
import { DiscoveryService } from './discovery.service';
import type { PieceDiscoverQueryDto, WriterDiscoverQueryDto } from './dto/discover-query.dto';
import type { FeedCacheService } from './feed-cache.service';
import { FeedRepository } from './feed.repository';

function writerRow(over: Partial<WriterCardRow> = {}): WriterCardRow {
  return {
    userId: 'u1',
    username: 'meera',
    penName: 'Meera',
    avatarKey: null,
    bio: null,
    followersCount: 10,
    piecesCount: 5,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    ...over,
  };
}

function build() {
  const discovery = {
    popularWriters: jest.fn().mockResolvedValue([writerRow()]),
    newWriters: jest.fn().mockResolvedValue([writerRow()]),
    featuredWriters: jest.fn().mockResolvedValue([writerRow()]),
    trendingTags: jest.fn().mockResolvedValue([{ slug: 'barish', name: 'barish', pieceCount: 3 }]),
    trendingGenres: jest
      .fn()
      .mockResolvedValue([{ slug: 'ghazal', name: 'Ghazal', pieceCount: 2 }]),
    trendingLanguages: jest
      .fn()
      .mockResolvedValue([{ code: 'ur', nativeName: 'اردو', direction: 'rtl', pieceCount: 4 }]),
  };
  const feed = { listPublic: jest.fn().mockResolvedValue([]) };
  const cache = {
    remember: jest
      .fn()
      .mockImplementation((_k: string, _ttl: number, compute: () => unknown) => compute()),
  };
  const service = new DiscoveryService(
    discovery as unknown as DiscoveryRepository,
    feed as unknown as FeedRepository,
    cache as unknown as FeedCacheService,
  );
  return { service, discovery, feed, cache };
}

const wq = (over: Partial<WriterDiscoverQueryDto>): WriterDiscoverQueryDto =>
  ({ limit: 20, kind: WriterKind.Popular, ...over }) as WriterDiscoverQueryDto;
const pq = (over: Partial<PieceDiscoverQueryDto>): PieceDiscoverQueryDto =>
  ({ limit: 20, kind: DiscoverPieceKind.Recent, ...over }) as PieceDiscoverQueryDto;

describe('DiscoveryService — writers', () => {
  it('caches + serves the popular first page', async () => {
    const { service, discovery, cache } = build();
    const page = await service.getWriters(wq({ kind: WriterKind.Popular }));
    expect(cache.remember).toHaveBeenCalledWith(
      expect.stringContaining('discover:writers:popular'),
      expect.any(Number),
      expect.any(Function),
    );
    expect(discovery.popularWriters).toHaveBeenCalledWith(null, 20);
    expect(page.items[0]).toMatchObject({ username: 'meera', followersCount: 10 });
  });

  it('bypasses cache for deeper popular pages (cursor present)', async () => {
    const { service, discovery, cache } = build();
    const cursor = encodeCursor({ k: '5', id: 'u9' });
    await service.getWriters(wq({ kind: WriterKind.Popular, cursor }));
    expect(cache.remember).not.toHaveBeenCalled();
    expect(discovery.popularWriters).toHaveBeenCalledWith({ k: '5', id: 'u9' }, 20);
  });

  it('serves new writers via keyset (no cache)', async () => {
    const { service, discovery, cache } = build();
    await service.getWriters(wq({ kind: WriterKind.New }));
    expect(discovery.newWriters).toHaveBeenCalled();
    expect(cache.remember).not.toHaveBeenCalled();
  });

  it('serves featured writers from a cached snapshot', async () => {
    const { service, discovery, cache } = build();
    const page = await service.getWriters(wq({ kind: WriterKind.Featured }));
    expect(cache.remember).toHaveBeenCalledWith(
      expect.stringContaining('discover:writers:featured'),
      expect.any(Number),
      expect.any(Function),
    );
    expect(discovery.featuredWriters).toHaveBeenCalled();
    expect(page.items).toHaveLength(1);
  });
});

describe('DiscoveryService — pieces', () => {
  it('maps recent → latest sort', async () => {
    const { service, feed } = build();
    await service.getPieces(pq({ kind: DiscoverPieceKind.Recent }));
    expect(feed.listPublic).toHaveBeenCalledWith(FeedSort.Latest, {}, null, 20);
  });

  it('maps most_discussed → most_discussed sort', async () => {
    const { service, feed } = build();
    await service.getPieces(pq({ kind: DiscoverPieceKind.MostDiscussed }));
    expect(feed.listPublic).toHaveBeenCalledWith(FeedSort.MostDiscussed, {}, null, 20);
  });

  it('maps featured → most_clapped within a recent window (dateFrom filter)', async () => {
    const { service, feed } = build();
    await service.getPieces(pq({ kind: DiscoverPieceKind.Featured }));
    const [sort, filters] = feed.listPublic.mock.calls[0];
    expect(sort).toBe(FeedSort.MostClapped);
    expect((filters as { dateFrom?: string }).dateFrom).toBeDefined();
  });
});

describe('DiscoveryService — trending taxonomy (cached)', () => {
  const q: CursorPaginationDto = { limit: 20 };

  it('serves trending tags from cache', async () => {
    const { service, discovery } = build();
    const page = await service.getTrendingTags(q);
    expect(discovery.trendingTags).toHaveBeenCalled();
    expect(page.items[0]).toEqual({ slug: 'barish', name: 'barish', pieceCount: 3 });
  });

  it('serves trending genres + languages from cache', async () => {
    const { service, discovery } = build();
    const genres = await service.getTrendingGenres(q);
    const languages = await service.getTrendingLanguages(q);
    expect(discovery.trendingGenres).toHaveBeenCalled();
    expect(discovery.trendingLanguages).toHaveBeenCalled();
    expect(genres.items[0]?.slug).toBe('ghazal');
    expect(languages.items[0]?.code).toBe('ur');
  });
});
