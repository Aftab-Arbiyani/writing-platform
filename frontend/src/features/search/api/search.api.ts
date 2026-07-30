import type { SearchType } from '@qalam/shared';

import { del, get, getPage, type CursorPage } from '@/lib/api-client';
import { buildQueryString } from '@/lib/http';
import type { SearchFilters } from '@/lib/query-keys';

import type {
  AutocompleteResult,
  GlobalSearchResult,
  RecentSearch,
  SearchGenre,
  SearchLanguage,
  SearchPiece,
  SearchTag,
  SearchWriter,
  TrendingSearches,
} from '../types/search.types';

/**
 * The search `api/` layer — the only place the E8 endpoints are named (docs/32 §10). Query
 * strings are built here (`buildQueryString`), never in components; cursors are threaded through
 * `getPage`. Every list method takes an `AbortSignal` so a stale query (tab/filter/keystroke
 * change) is cancelled by TanStack Query (docs/32 §5).
 */

interface GlobalArgs {
  type?: SearchType;
  limit?: number;
  signal?: AbortSignal;
}

interface ListArgs {
  q: string;
  cursor?: string;
  limit?: number;
  filters?: SearchFilters;
  signal?: AbortSignal;
}

interface TaxonomyListArgs {
  q?: string;
  cursor?: string;
  limit?: number;
  signal?: AbortSignal;
}

/** Piece-search wire params (SearchPiecesQueryDto). Multi-value filters are comma-joined upstream. */
function toPieceParams(filters: SearchFilters): Record<string, string | number | undefined> {
  return {
    language: filters.language,
    genre: filters.genre,
    tag: filters.tag,
    sort: filters.sort,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    minReadingTime: filters.minReadingTime,
    maxReadingTime: filters.maxReadingTime,
  };
}

/** Writer-search wire params (SearchWritersQueryDto) — only language/genre narrow a writer. */
function toWriterParams(filters: SearchFilters): Record<string, string | undefined> {
  return { language: filters.language, genre: filters.genre };
}

export const searchApi = {
  /** GET /search — grouped relevance preview across every group (small top-N each). */
  global: (q: string, { type, limit, signal }: GlobalArgs = {}): Promise<GlobalSearchResult> => {
    const query = buildQueryString({ q, type, limit });
    return get<GlobalSearchResult>(`/search${query}`, { signal });
  },

  /** GET /search/pieces — full-text piece search, filtered + sorted, cursor-paginated. */
  pieces: ({
    q,
    cursor,
    limit = 20,
    filters = {},
    signal,
  }: ListArgs): Promise<CursorPage<SearchPiece>> => {
    const query = buildQueryString({ q, cursor, limit, ...toPieceParams(filters) });
    return getPage<SearchPiece>(`/search/pieces${query}`, { signal });
  },

  /** GET /search/writers — writer search over name/bio, cursor-paginated. */
  writers: ({
    q,
    cursor,
    limit = 20,
    filters = {},
    signal,
  }: ListArgs): Promise<CursorPage<SearchWriter>> => {
    const query = buildQueryString({ q, cursor, limit, ...toWriterParams(filters) });
    return getPage<SearchWriter>(`/search/writers${query}`, { signal });
  },

  /** GET /search/tags — tag search (omit q to browse by usage), cursor-paginated. */
  tags: ({ q, cursor, limit = 20, signal }: TaxonomyListArgs): Promise<CursorPage<SearchTag>> => {
    const query = buildQueryString({ q, cursor, limit });
    return getPage<SearchTag>(`/search/tags${query}`, { signal });
  },

  /** GET /search/genres — genre search (omit q to browse by count), cursor-paginated. */
  genres: ({
    q,
    cursor,
    limit = 20,
    signal,
  }: TaxonomyListArgs): Promise<CursorPage<SearchGenre>> => {
    const query = buildQueryString({ q, cursor, limit });
    return getPage<SearchGenre>(`/search/genres${query}`, { signal });
  },

  /** GET /search/languages — language search (omit q to browse by count), cursor-paginated. */
  languages: ({
    q,
    cursor,
    limit = 20,
    signal,
  }: TaxonomyListArgs): Promise<CursorPage<SearchLanguage>> => {
    const query = buildQueryString({ q, cursor, limit });
    return getPage<SearchLanguage>(`/search/languages${query}`, { signal });
  },

  /** GET /search/autocomplete — ≤10 prefix-first suggestions per group (cached). */
  autocomplete: (
    q: string,
    { type, limit, signal }: GlobalArgs = {},
  ): Promise<AutocompleteResult> => {
    const query = buildQueryString({ q, type, limit });
    return get<AutocompleteResult>(`/search/autocomplete${query}`, { signal });
  },

  /** GET /search/trending — popular keywords/tags/genres/writers (cached snapshot). */
  trending: ({
    limit,
    signal,
  }: { limit?: number; signal?: AbortSignal } = {}): Promise<TrendingSearches> => {
    const query = buildQueryString({ limit });
    return get<TrendingSearches>(`/search/trending${query}`, { signal });
  },

  /** GET /search/recent — the signed-in user's recent searches, newest first (≤20). */
  recent: (signal?: AbortSignal): Promise<RecentSearch[]> =>
    get<RecentSearch[]>('/search/recent', { signal }),

  /** DELETE /search/recent/:id — forget one recent search. */
  deleteRecent: (id: string): Promise<void> => del(`/search/recent/${encodeURIComponent(id)}`),

  /** DELETE /search/recent — clear the whole recent list. */
  clearRecent: (): Promise<void> => del('/search/recent'),
};
