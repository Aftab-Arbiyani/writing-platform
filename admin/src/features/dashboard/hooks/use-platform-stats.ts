import { PERMISSIONS } from '@qalam/shared';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { usePermissions } from '@/hooks/use-permissions';
import { qk } from '@/lib/query-keys';

import { dashboardApi } from '../api/dashboard.api';
import type { PlatformStats } from '../types/dashboard.types';

/**
 * Platform overview counts (`GET /analytics/platform`). Gated on `analytics.view` so an operator who
 * lacks it never fires a doomed 403 (docs: "avoid unnecessary permission requests") — the widget
 * shows access-denied instead. Cached; the caller can pass the enabled state through `allowed`.
 */
export function usePlatformStats(): UseQueryResult<PlatformStats, Error> {
  const { can } = usePermissions();
  return useQuery<PlatformStats, Error>({
    queryKey: qk.dashboard.platform(),
    queryFn: ({ signal }) => dashboardApi.platformStats(signal),
    enabled: can(PERMISSIONS.AnalyticsView),
    staleTime: 60_000,
  });
}
