import { getPage, type CursorPage } from '@/lib/api-client';
import { buildQueryString } from '@/lib/http';
import type { FeedFilters, FeedTab } from '@/lib/query-keys';

import type { FeedItem, TrendingGenre, TrendingLanguage, TrendingTag } from '../types/feed.types';

/**
 * The feed/discover `api/` layer — the only place these endpoints are named (docs/32 §10).
 * Every list is cursor-paginated (`getPage` keeps `meta.nextCursor`). The `tab` maps to an
 * endpoint PATH (docs/12 §2.1.1). Query strings are built here, never in components.
 */

interface ListArgs {
  cursor?: string;
  limit?: number;
  filters?: FeedFilters;
  signal?: AbortSignal;
}

/** `sort` is meaningless on the trending endpoint (the server forces it) — omit it there. */
function toWireParams(
  tab: FeedTab,
  filters: FeedFilters,
): Record<string, string | number | undefined> {
  return {
    language: filters.language,
    genre: filters.genre,
    tag: filters.tag,
    sort: tab === 'trending' ? undefined : filters.sort,
    minReadingTime: filters.minReadingTime,
    maxReadingTime: filters.maxReadingTime,
  };
}

export const feedApi = {
  /** GET /feed/{following|latest|trending|discover} — one page of piece cards. */
  list: (
    tab: FeedTab,
    { cursor, limit = 20, filters = {}, signal }: ListArgs,
  ): Promise<CursorPage<FeedItem>> => {
    const query = buildQueryString({ cursor, limit, ...toWireParams(tab, filters) });
    return getPage<FeedItem>(`/feed/${tab}${query}`, { signal });
  },
};

export const discoverApi = {
  /** GET /discover/tags — trending tags (rail + tag filter chips). */
  tags: (signal?: AbortSignal): Promise<CursorPage<TrendingTag>> =>
    getPage<TrendingTag>('/discover/tags', { signal }),

  /** GET /discover/genres — trending genres (rail + genre filter options). */
  genres: (signal?: AbortSignal): Promise<CursorPage<TrendingGenre>> =>
    getPage<TrendingGenre>('/discover/genres', { signal }),

  /** GET /discover/languages — trending languages (language filter options). */
  languages: (signal?: AbortSignal): Promise<CursorPage<TrendingLanguage>> =>
    getPage<TrendingLanguage>('/discover/languages', { signal }),
};
