import { AnalyticsPeriod } from '@qalam/shared';
import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { analyticsApi } from '../api/analytics.api';

/**
 * Platform-wide trending (`GET /analytics/trending`) — pieces / writers / genres / tags for a
 * window. Public + cached server-side, so a generous client staleTime fits. A small "Trending on
 * Qalam" widget on the dashboard (context for the writer, not their own numbers).
 */
export function useAnalyticsTrending(period: AnalyticsPeriod = AnalyticsPeriod.Weekly) {
  return useQuery({
    queryKey: qk.analytics.trending(period),
    queryFn: ({ signal }) => analyticsApi.trending({ period, signal }),
    staleTime: 5 * 60_000,
  });
}
