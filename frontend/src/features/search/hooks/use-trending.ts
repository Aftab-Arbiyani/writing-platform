import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { searchApi } from '../api/search.api';

/** Trending is a cached server snapshot (300s) — a generous client `staleTime` matches. */
const TRENDING_STALE_MS = 5 * 60 * 1000;

/**
 * Trending searches (`GET /search/trending`) — popular keywords, tags, genres, and writers.
 * Public (no auth). Shown in the empty search panel + on the discovery screen. Prefetchable so
 * the command dropdown opens with content already warm (docs/12 §2.4 — prefetch popular data).
 */
export function useTrending(enabled = true) {
  return useQuery({
    queryKey: qk.search.trending(),
    queryFn: ({ signal }) => searchApi.trending({ signal }),
    staleTime: TRENDING_STALE_MS,
    enabled,
  });
}
