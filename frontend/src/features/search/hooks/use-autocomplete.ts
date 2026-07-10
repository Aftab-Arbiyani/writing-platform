import { SEARCH_QUERY_MIN } from '@qalam/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useDebounce } from '@/hooks/use-debounce';
import { qk } from '@/lib/query-keys';

import { searchApi } from '../api/search.api';

/** Debounce window for instant suggestions (docs/06 §3.6 — 300ms). */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Instant autocomplete suggestions (docs/06 §3.6). The raw input is debounced 300ms here, then
 * queried only once it clears the 2-char minimum (docs 05 §3.2) — so we never fire a doomed
 * `SEARCH_QUERY_TOO_SHORT`. Suggestions are cached 60s server-side; a short client `staleTime`
 * matches. `keepPreviousData` keeps the old suggestions on screen (no flicker) while the next
 * keystroke's query resolves. The query's own `signal` cancels superseded requests (docs/32 §5).
 */
export function useAutocomplete(rawQuery: string) {
  const debounced = useDebounce(rawQuery.trim(), SEARCH_DEBOUNCE_MS);
  const enabled = debounced.length >= SEARCH_QUERY_MIN;

  const query = useQuery({
    queryKey: qk.search.autocomplete(debounced),
    queryFn: ({ signal }) => searchApi.autocomplete(debounced, { signal }),
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  return {
    ...query,
    /** The query the current suggestions correspond to (post-debounce). */
    debouncedQuery: debounced,
    /** True while the debounce is still catching up to fresh keystrokes. */
    isTyping: enabled && debounced !== rawQuery.trim(),
    /** Whether the input is long enough to autocomplete at all. */
    isQueryable: enabled,
  };
}
