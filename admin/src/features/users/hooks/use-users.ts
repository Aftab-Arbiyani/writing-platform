import { PERMISSIONS } from '@qalam/shared';
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { usePermissions } from '@/hooks/use-permissions';
import { qk } from '@/lib/query-keys';

import { usersApi, type UserListPage } from '../api/users.api';
import type { UserListParams } from '../types/users.types';

/**
 * The admin user grid (`GET /admin/users`). Offset-paginated; `keepPreviousData`
 * keeps the current page visible while the next loads (no flash on page/filter
 * change). Gated on `user.view` so we never fire a doomed 403. `params` (from
 * `useAdminTable.queryParams` + sort) is embedded in the key → each page/filter
 * combination caches independently.
 */
export function useUsers(params: UserListParams): UseQueryResult<UserListPage, Error> {
  const { can } = usePermissions();
  return useQuery<UserListPage, Error>({
    queryKey: qk.users.list(params),
    queryFn: ({ signal }) => usersApi.list(params, signal),
    enabled: can(PERMISSIONS.UserView),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}
