import { useQuery, type QueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth.store';

import { analyticsApi } from '../api/analytics.api';

/** Analytics update nightly (docs/06 §3.10), so a generous Content-tier staleTime fits (docs/12 §2.2). */
const ANALYTICS_STALE_MS = 5 * 60_000;

/**
 * The combined writer + reader dashboard (`GET /analytics/dashboard`) — one call for every overview
 * card + the reader-insights section. Cached (Content tier); auth-gated. This supersedes the
 * separate `/analytics/me` + `/analytics/readers/me` (same data, one request).
 */
export function useDashboard(enabled = true) {
  const isAuthed = useAuthStore((s) => s.status === 'authenticated');
  return useQuery({
    queryKey: qk.analytics.dashboard(),
    queryFn: ({ signal }) => analyticsApi.dashboard(signal),
    enabled: enabled && isAuthed,
    staleTime: ANALYTICS_STALE_MS,
  });
}

/** Warm the dashboard cache ahead of navigation (docs: "prefetch dashboard overview"). */
export function prefetchDashboard(client: QueryClient): Promise<void> {
  return client.prefetchQuery({
    queryKey: qk.analytics.dashboard(),
    queryFn: ({ signal }) => analyticsApi.dashboard(signal),
    staleTime: ANALYTICS_STALE_MS,
  });
}
