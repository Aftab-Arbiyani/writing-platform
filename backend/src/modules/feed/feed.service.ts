import { Injectable } from '@nestjs/common';
import { FeedSort } from '@qalam/shared';

import { buildCursorPage } from '../../common/pagination/pagination.helper';
import type { CursorPage } from '../../common/types/paginated-result';
import { TaxonomyService } from '../taxonomy/taxonomy.service';
import type { FeedItemDto } from './dto/feed-item.dto';
import type { FeedQueryDto } from './dto/feed-query.dto';
import { cardCursorKey, type CardRow, type ResolvedFeedFilters } from './feed.repository';
import { FeedRepository } from './feed.repository';
import { parseFeedCursor } from './feed-cursor.util';
import { toFeedItem } from './feed.mappers';
import { TrendingService } from './trending.service';

/**
 * The four feeds (docs 18 E6). Following = accepted-followed authors newest-first;
 * Latest = filterable/sortable public browse; Trending = delegated to the scoring
 * service; Discover = author-diverse public sampling. Cards are hydrated in one
 * query (no N+1) and keyset-paginated. Visibility/privacy live in the repository
 * predicates and mirror the E7 read rules (docs 13 §4.2).
 */
@Injectable()
export class FeedService {
  constructor(
    private readonly feed: FeedRepository,
    private readonly taxonomy: TaxonomyService,
    private readonly trending: TrendingService,
  ) {}

  /** Pieces from writers the viewer follows (accepted), newest published first. */
  async getFollowing(viewerId: string, query: FeedQueryDto): Promise<CursorPage<FeedItemDto>> {
    const filters = await this.resolveFilters(query);
    const cursor = parseFeedCursor(query.cursor);
    const rows = await this.feed.listFollowing(viewerId, filters, cursor, query.limit);
    return this.toPage(rows, query.limit, FeedSort.Latest);
  }

  /** Newest published public pieces, with filters + sort (latest by default). */
  async getLatest(query: FeedQueryDto): Promise<CursorPage<FeedItemDto>> {
    if (query.sort === FeedSort.Trending) {
      // Trending is a global cached ranking (filters do not apply — see README).
      return this.trending.getFeed(query.cursor, query.limit);
    }
    const filters = await this.resolveFilters(query);
    const cursor = parseFeedCursor(query.cursor);
    const rows = await this.feed.listPublic(query.sort, filters, cursor, query.limit);
    return this.toPage(rows, query.limit, query.sort);
  }

  /** Author-diverse public feed: one (latest) piece per author, recency-ordered. */
  async getDiscover(query: FeedQueryDto): Promise<CursorPage<FeedItemDto>> {
    const cursor = parseFeedCursor(query.cursor);
    const rows = await this.feed.listDiscover(cursor, query.limit);
    return this.toPage(rows, query.limit, FeedSort.Latest);
  }

  // ── helpers ────────────────────────────────────────────────────────────

  private toPage(rows: CardRow[], limit: number, sort: FeedSort): CursorPage<FeedItemDto> {
    const page = buildCursorPage(rows, limit, (row) => ({
      k: cardCursorKey(row, sort),
      id: row.id,
    }));
    return { items: page.items.map(toFeedItem), meta: page.meta };
  }

  /** Resolves language codes → ids and genre slugs → ids (reusing TaxonomyService). */
  private async resolveFilters(query: FeedQueryDto): Promise<ResolvedFeedFilters> {
    const languageIds =
      query.language !== undefined
        ? await Promise.all(
            splitCsv(query.language).map((c) => this.taxonomy.resolveLanguageCode(c)),
          )
        : undefined;
    const genreIds =
      query.genre !== undefined
        ? await this.taxonomy.resolveGenreSlugs(splitCsv(query.genre))
        : undefined;

    return {
      languageIds,
      genreIds,
      tagSlug: query.tag?.trim().toLowerCase(),
      visibility: query.visibility,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      minReadingTime: query.minReadingTime,
      maxReadingTime: query.maxReadingTime,
    };
  }
}

/** Splits a comma-separated multi-value filter, trimming + dropping blanks. */
function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}
