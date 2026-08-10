import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth.store';

import { analyticsApi } from '../api/analytics.api';

/** Analytics update nightly (docs/06 §3.10), so a generous Content-tier staleTime fits (docs/12 §2.2). */
const ANALYTICS_STALE_MS = 5 * 60_000;

/**
 * The reader's own aggregate (`GET /analytics/readers/me`) — the `/me/reading` surface (W7c).
 * Auth-gated: the endpoint identifies the reader from the JWT, so it is disabled until the session
 * is authenticated and the route itself sits behind `RequireAuth`.
 *
 * Deliberately NOT `useDashboard()`. That call returns `{writer, reader}` and belongs to the writer
 * dashboard; a reader who has never published should not fetch writer aggregates to see their own
 * reading. Both keys are cached independently, so visiting one surface does not invalidate the other.
 *
 * On failure this reports the error and the page says so. It does NOT fall back to zeroes — mobile
 * degrades to local device history here, which web does not have ([48 §4]), so a fabricated zero
 * would be the only alternative and that is the one thing forbidden.
 */
export function useReaderAnalytics(enabled = true) {
  const isAuthed = useAuthStore((s) => s.status === 'authenticated');
  return useQuery({
    queryKey: qk.analytics.readers(),
    queryFn: ({ signal }) => analyticsApi.reader(signal),
    enabled: enabled && isAuthed,
    staleTime: ANALYTICS_STALE_MS,
  });
}

/**
 * The viewer's BOUNDED bookmarks count (one `limit=50` page of `GET /me/bookmarks`).
 *
 * Separate from `useReaderAnalytics` on purpose: it is a different endpoint with a different
 * failure mode, and the reading page must render the seven real aggregate fields even when this
 * secondary read fails. A failure here therefore hides the bookmarks tile rather than failing the
 * page — the count is an augmentation, not one of the row's figures.
 */
export function useMyBookmarksCount(enabled = true) {
  const isAuthed = useAuthStore((s) => s.status === 'authenticated');
  return useQuery({
    queryKey: qk.analytics.bookmarksCount(),
    queryFn: ({ signal }) => analyticsApi.bookmarksCount(signal),
    enabled: enabled && isAuthed,
    staleTime: ANALYTICS_STALE_MS,
  });
}
