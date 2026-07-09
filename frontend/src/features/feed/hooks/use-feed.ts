import { useInfiniteQuery } from '@tanstack/react-query';

import { qk, type FeedFilters, type FeedTab } from '@/lib/query-keys';

import { feedApi } from '../api/feed.api';

/**
 * The infinite feed query (docs/12 §2.3) over the ADR §5 cursor contract. Live tier: 30s
 * `staleTime` + refetch-on-focus for social freshness (docs/12 §2.2). `getNextPageParam`
 * reads `meta.nextCursor` (null = end). The signal from `queryFn` is threaded to the client so
 * a tab/filter change aborts the stale request (docs/32 §5).
 *
 * `enabled` is false for the following tab when signed out (it needs the viewer); the page
 * renders a sign-in prompt instead of firing a guaranteed 401.
 */
export function useFeed(tab: FeedTab, filters: FeedFilters, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.feed.list(tab, filters),
    queryFn: ({ pageParam, signal }) => feedApi.list(tab, { cursor: pageParam, filters, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    enabled,
  });
}
