import { Injectable } from '@nestjs/common';
import { DiscoverPieceKind, FeedSort, WriterKind } from '@qalam/shared';

import type { CursorPaginationDto } from '../../common/dto/cursor-pagination.dto';
import { buildCursorPage } from '../../common/pagination/pagination.helper';
import type { CursorPage } from '../../common/types/paginated-result';
import { DiscoveryRepository } from './discovery.repository';
import type { PieceDiscoverQueryDto, WriterDiscoverQueryDto } from './dto/discover-query.dto';
import type { FeedItemDto } from './dto/feed-item.dto';
import type { TrendingGenreDto, TrendingLanguageDto, TrendingTagDto } from './dto/trend-item.dto';
import type { WriterCardDto } from './dto/writer-card.dto';
import { FEED_CACHE_KEYS, FeedCacheService } from './feed-cache.service';
import { cardCursorKey, type ResolvedFeedFilters } from './feed.repository';
import { FeedRepository } from './feed.repository';
import { parseFeedCursor, paginateSnapshot } from './feed-cursor.util';
import { toFeedItem, toWriterCard } from './feed.mappers';

/** Discovery windows/pools — small, cheap top-N widgets cached in Redis. */
const DISCOVERY = { lookbackDays: 30, poolSize: 50, ttlSeconds: 600 } as const;

/**
 * Discovery surfaces (docs 18 E6 task 5): writers (featured / popular / new),
 * pieces (featured / recent / most-clapped / most-discussed), and trending tags /
 * genres / languages. Popular/new writers and pieces are DB keyset-paginated;
 * featured writers + trending taxonomy are cached top-N snapshots paginated in
 * memory. Private accounts are never surfaced (repository predicates).
 */
@Injectable()
export class DiscoveryService {
  constructor(
    private readonly discovery: DiscoveryRepository,
    private readonly feed: FeedRepository,
    private readonly cache: FeedCacheService,
  ) {}

  // ── writers ────────────────────────────────────────────────────────────

  async getWriters(query: WriterDiscoverQueryDto): Promise<CursorPage<WriterCardDto>> {
    switch (query.kind) {
      case WriterKind.New:
        return this.newWritersPage(query.cursor, query.limit);
      case WriterKind.Featured: {
        const pool = await this.cache.remember<WriterCardDto[]>(
          FEED_CACHE_KEYS.featuredWriters,
          DISCOVERY.ttlSeconds,
          async () =>
            (await this.discovery.featuredWriters(DISCOVERY.lookbackDays, DISCOVERY.poolSize)).map(
              toWriterCard,
            ),
        );
        return paginateSnapshot(pool, query.cursor, query.limit);
      }
      case WriterKind.Popular:
      default:
        // Cache only the hot first page; deeper pages go straight to the keyset query.
        if (query.cursor === undefined || query.cursor === '') {
          return this.cache.remember<CursorPage<WriterCardDto>>(
            FEED_CACHE_KEYS.popularWritersFirstPage(query.limit),
            DISCOVERY.ttlSeconds,
            () => this.popularWritersPage(undefined, query.limit),
          );
        }
        return this.popularWritersPage(query.cursor, query.limit);
    }
  }

  private async popularWritersPage(
    rawCursor: string | undefined,
    limit: number,
  ): Promise<CursorPage<WriterCardDto>> {
    const rows = await this.discovery.popularWriters(parseFeedCursor(rawCursor), limit);
    const page = buildCursorPage(rows, limit, (r) => ({
      k: String(r.followersCount),
      id: r.userId,
    }));
    return { items: page.items.map(toWriterCard), meta: page.meta };
  }

  private async newWritersPage(
    rawCursor: string | undefined,
    limit: number,
  ): Promise<CursorPage<WriterCardDto>> {
    const rows = await this.discovery.newWriters(parseFeedCursor(rawCursor), limit);
    const page = buildCursorPage(rows, limit, (r) => ({
      k: new Date(r.createdAt).toISOString(),
      id: r.userId,
    }));
    return { items: page.items.map(toWriterCard), meta: page.meta };
  }

  // ── pieces ───────────────────────────────────────────────────────────────

  async getPieces(query: PieceDiscoverQueryDto): Promise<CursorPage<FeedItemDto>> {
    const { sort, filters } = pieceKindToQuery(query.kind);
    const rows = await this.feed.listPublic(
      sort,
      filters,
      parseFeedCursor(query.cursor),
      query.limit,
    );
    const page = buildCursorPage(rows, query.limit, (r) => ({
      k: cardCursorKey(r, sort),
      id: r.id,
    }));
    return { items: page.items.map(toFeedItem), meta: page.meta };
  }

  // ── trending taxonomy (cached widgets) ─────────────────────────────────────

  async getTrendingTags(query: CursorPaginationDto): Promise<CursorPage<TrendingTagDto>> {
    const pool = await this.cache.remember<TrendingTagDto[]>(
      FEED_CACHE_KEYS.trendingTags,
      DISCOVERY.ttlSeconds,
      async () =>
        (await this.discovery.trendingTags(DISCOVERY.lookbackDays, DISCOVERY.poolSize)).map(
          (t) => ({
            slug: t.slug,
            name: t.name,
            pieceCount: Number(t.pieceCount),
          }),
        ),
    );
    return paginateSnapshot(pool, query.cursor, query.limit);
  }

  async getTrendingGenres(query: CursorPaginationDto): Promise<CursorPage<TrendingGenreDto>> {
    const pool = await this.cache.remember<TrendingGenreDto[]>(
      FEED_CACHE_KEYS.trendingGenres,
      DISCOVERY.ttlSeconds,
      async () =>
        (await this.discovery.trendingGenres(DISCOVERY.lookbackDays, DISCOVERY.poolSize)).map(
          (g) => ({
            slug: g.slug,
            name: g.name,
            pieceCount: Number(g.pieceCount),
          }),
        ),
    );
    return paginateSnapshot(pool, query.cursor, query.limit);
  }

  async getTrendingLanguages(query: CursorPaginationDto): Promise<CursorPage<TrendingLanguageDto>> {
    const pool = await this.cache.remember<TrendingLanguageDto[]>(
      FEED_CACHE_KEYS.trendingLanguages,
      DISCOVERY.ttlSeconds,
      async () =>
        (await this.discovery.trendingLanguages(DISCOVERY.lookbackDays, DISCOVERY.poolSize)).map(
          (l) => ({
            code: l.code,
            nativeName: l.nativeName,
            direction: l.direction as TrendingLanguageDto['direction'],
            pieceCount: Number(l.pieceCount),
          }),
        ),
    );
    return paginateSnapshot(pool, query.cursor, query.limit);
  }
}

/** Maps a discover-piece kind to the feed sort + any implied filter window. */
function pieceKindToQuery(kind: DiscoverPieceKind): {
  sort: Exclude<FeedSort, 'trending'>;
  filters: ResolvedFeedFilters;
} {
  switch (kind) {
    case DiscoverPieceKind.MostClapped:
      return { sort: FeedSort.MostClapped, filters: {} };
    case DiscoverPieceKind.MostDiscussed:
      return { sort: FeedSort.MostDiscussed, filters: {} };
    case DiscoverPieceKind.Featured:
      // "Featured" = best-of the recent window (most clapped in the last 30 days).
      return {
        sort: FeedSort.MostClapped,
        filters: { dateFrom: new Date(Date.now() - 30 * 86_400_000).toISOString() },
      };
    case DiscoverPieceKind.Recent:
    default:
      return { sort: FeedSort.Latest, filters: {} };
  }
}
