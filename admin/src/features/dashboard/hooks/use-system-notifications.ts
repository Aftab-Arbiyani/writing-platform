import { PERMISSIONS } from '@qalam/shared';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { usePermissions } from '@/hooks/use-permissions';
import { qk } from '@/lib/query-keys';

import { dashboardApi } from '../api/dashboard.api';
import type { SystemNotification } from '../types/dashboard.types';

/**
 * Admin-authored system broadcasts (`GET /admin/system-notifications`). Gated on `notification.manage`.
 * These are notices/maintenance announcements (not backend-generated alerts) — folded into the
 * alerts widget as `info` items.
 */
export function useSystemNotifications(limit = 10): UseQueryResult<SystemNotification[], Error> {
  const { can } = usePermissions();
  return useQuery<SystemNotification[], Error>({
    queryKey: qk.dashboard.systemNotifications(limit),
    queryFn: ({ signal }) => dashboardApi.systemNotifications(limit, signal),
    enabled: can(PERMISSIONS.NotificationManage),
    staleTime: 60_000,
  });
}
