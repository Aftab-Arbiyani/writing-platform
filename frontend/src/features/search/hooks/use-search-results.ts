import { SearchType, SEARCH_QUERY_MIN } from '@qalam/shared';
import { useInfiniteQuery } from '@tanstack/react-query';

import { qk, type SearchFilters } from '@/lib/query-keys';

import { searchApi } from '../api/search.api';

/**
 * The per-type infinite result queries (docs/12 §2.3) over the ADR §5 cursor contract. One hook
 * per group, each mounted only while its tab is active (the results component swaps subcomponents
 * on tab change), so the rules of hooks hold and every list is strictly typed — no unions to cast.
 *
 * `getNextPageParam` reads `meta.nextCursor` (null = end); the `queryFn` signal cancels a stale
 * request when the query/filters change (docs/32 §5). Pieces/writers need a ≥2-char query;
 * tags/genres/languages accept an empty query (browse by popularity), so they stay enabled.
 */

const RESULTS_STALE_MS = 30_000;
const INITIAL_CURSOR = undefined as string | undefined;

function longEnough(q: string): boolean {
  return q.trim().length >= SEARCH_QUERY_MIN;
}

/** For taxonomy browse: pass the query only when it clears the minimum, else undefined (browse). */
function taxonomyQuery(q: string): string | undefined {
  return longEnough(q) ? q.trim() : undefined;
}

export function useSearchPieces(q: string, filters: SearchFilters, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.search.results(SearchType.Pieces, q.trim(), filters),
    queryFn: ({ pageParam, signal }) =>
      searchApi.pieces({ q: q.trim(), cursor: pageParam, filters, signal }),
    initialPageParam: INITIAL_CURSOR,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    staleTime: RESULTS_STALE_MS,
    enabled: enabled && longEnough(q),
  });
}

export function useSearchWriters(q: string, filters: SearchFilters, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.search.results(SearchType.Writers, q.trim(), filters),
    queryFn: ({ pageParam, signal }) =>
      searchApi.writers({ q: q.trim(), cursor: pageParam, filters, signal }),
    initialPageParam: INITIAL_CURSOR,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    staleTime: RESULTS_STALE_MS,
    enabled: enabled && longEnough(q),
  });
}

export function useSearchTags(q: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.search.results(SearchType.Tags, q.trim(), {}),
    queryFn: ({ pageParam, signal }) =>
      searchApi.tags({ q: taxonomyQuery(q), cursor: pageParam, signal }),
    initialPageParam: INITIAL_CURSOR,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    staleTime: RESULTS_STALE_MS,
    enabled,
  });
}

export function useSearchGenres(q: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.search.results(SearchType.Genres, q.trim(), {}),
    queryFn: ({ pageParam, signal }) =>
      searchApi.genres({ q: taxonomyQuery(q), cursor: pageParam, signal }),
    initialPageParam: INITIAL_CURSOR,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    staleTime: RESULTS_STALE_MS,
    enabled,
  });
}

export function useSearchLanguages(q: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.search.results(SearchType.Languages, q.trim(), {}),
    queryFn: ({ pageParam, signal }) =>
      searchApi.languages({ q: taxonomyQuery(q), cursor: pageParam, signal }),
    initialPageParam: INITIAL_CURSOR,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    staleTime: RESULTS_STALE_MS,
    enabled,
  });
}
