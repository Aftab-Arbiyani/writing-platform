import { PERMISSIONS } from '@qalam/shared';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { usePermissions } from '@/hooks/use-permissions';
import { qk } from '@/lib/query-keys';

import { usersApi, type AuditPage } from '../api/users.api';
import type {
  AdminLoginHistory,
  AdminUserActivity,
  AdminUserDetail,
  AdminUserStatistics,
} from '../types/users.types';

/**
 * Full detail for one user (`GET /admin/users/:id`). `id` is null when the drawer
 * is closed; the query is disabled until an id is selected. Content tier (5 min).
 */
export function useUser(id: string | null): UseQueryResult<AdminUserDetail, Error> {
  const { can } = usePermissions();
  return useQuery<AdminUserDetail, Error>({
    queryKey: qk.users.detail(id ?? 'none'),
    queryFn: ({ signal }) => usersApi.detail(id ?? '', signal),
    enabled: id !== null && can(PERMISSIONS.UserView),
    staleTime: 30_000,
  });
}

/** `GET /admin/users/:id/statistics` — fetched lazily when its drawer tab is active. */
export function useUserStatistics(
  id: string | null,
  enabled = true,
): UseQueryResult<AdminUserStatistics, Error> {
  const { can } = usePermissions();
  return useQuery<AdminUserStatistics, Error>({
    queryKey: qk.users.statistics(id ?? 'none'),
    queryFn: ({ signal }) => usersApi.statistics(id ?? '', signal),
    enabled: id !== null && enabled && can(PERMISSIONS.UserView),
    staleTime: 30_000,
  });
}

/** `GET /admin/users/:id/activity`. */
export function useUserActivity(
  id: string | null,
  enabled = true,
): UseQueryResult<AdminUserActivity, Error> {
  const { can } = usePermissions();
  return useQuery<AdminUserActivity, Error>({
    queryKey: qk.users.activity(id ?? 'none'),
    queryFn: ({ signal }) => usersApi.activity(id ?? '', signal),
    enabled: id !== null && enabled && can(PERMISSIONS.UserView),
    staleTime: 30_000,
  });
}

/** `GET /admin/users/:id/audit` — offset-paginated audit trail. */
export function useUserAudit(
  id: string | null,
  params: { page?: number; limit?: number; action?: string },
  enabled = true,
): UseQueryResult<AuditPage, Error> {
  const { can } = usePermissions();
  return useQuery<AuditPage, Error>({
    queryKey: qk.users.audit(id ?? 'none', params),
    queryFn: ({ signal }) => usersApi.audit(id ?? '', params, signal),
    enabled: id !== null && enabled && can(PERMISSIONS.UserView),
    staleTime: 30_000,
  });
}

/** `GET /admin/users/:id/login-history`. */
export function useUserLoginHistory(
  id: string | null,
  enabled = true,
): UseQueryResult<AdminLoginHistory, Error> {
  const { can } = usePermissions();
  return useQuery<AdminLoginHistory, Error>({
    queryKey: qk.users.loginHistory(id ?? 'none'),
    queryFn: ({ signal }) => usersApi.loginHistory(id ?? '', signal),
    enabled: id !== null && enabled && can(PERMISSIONS.UserView),
    staleTime: 30_000,
  });
}
