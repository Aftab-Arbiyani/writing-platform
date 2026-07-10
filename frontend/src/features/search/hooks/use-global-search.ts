import { SEARCH_QUERY_MIN } from '@qalam/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { searchApi } from '../api/search.api';

/**
 * The grouped global preview (`GET /search`) — a small relevance-ranked top-N per group. Powers
 * the "All" tab on the results page. Enabled only past the 2-char minimum. Search tier: results
 * are fresh-ish but expensive, so a modest `staleTime` (docs/12 §2.2) with previous data kept to
 * avoid a flash of empty groups while a new query resolves.
 */
export function useGlobalSearch(q: string, enabled = true) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: qk.search.global(trimmed),
    queryFn: ({ signal }) => searchApi.global(trimmed, { signal }),
    enabled: enabled && trimmed.length >= SEARCH_QUERY_MIN,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}
