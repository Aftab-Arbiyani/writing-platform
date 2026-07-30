import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth.store';

import { analyticsApi } from '../api/analytics.api';
import { useAnalyticsStore, windowFor } from '../stores/analytics.store';

/**
 * The writer's growth-over-time series (`GET /analytics/me/growth`) for the active date-range
 * preset (period + point count from the Zustand store). Snapshots are admin-generated (no cron in
 * `v1`), so this can legitimately return zero points — the chart shows an honest empty state.
 * `keepPreviousData` keeps the last series on screen while switching ranges (no flicker).
 */
export function useGrowth() {
  const isAuthed = useAuthStore((s) => s.status === 'authenticated');
  const range = useAnalyticsStore((s) => s.range);
  const { period, points } = windowFor(range);

  return useQuery({
    queryKey: qk.analytics.growth(period, points),
    queryFn: ({ signal }) => analyticsApi.growth({ period, points, signal }),
    enabled: isAuthed,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}
