import { PERMISSIONS } from '@qalam/shared';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { usePermissions } from '@/hooks/use-permissions';
import { qk } from '@/lib/query-keys';

import { dashboardApi } from '../api/dashboard.api';
import type { QueueStatus } from '../types/dashboard.types';

/**
 * BullMQ queue + worker status (`GET /admin/queues`). Gated on `admin.dashboard`. Feeds both the
 * Workers health tile and the alerts derivation (failed/stalled/paused). Short staleTime — queue
 * state is live.
 */
export function useQueues(): UseQueryResult<QueueStatus[], Error> {
  const { can } = usePermissions();
  return useQuery<QueueStatus[], Error>({
    queryKey: qk.dashboard.queues(),
    queryFn: ({ signal }) => dashboardApi.queues(signal),
    enabled: can(PERMISSIONS.AdminDashboard),
    staleTime: 30_000,
  });
}
