import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { usersApi } from '../api/users.api';
import type {
  AdminActionResult,
  AdminUserDetail,
  BulkAction,
  BulkActionResult,
  UpdateUserPayload,
  UserAction,
} from '../types/users.types';

/** PATCH /admin/users/:id — invalidates the whole users namespace on success. */
export function useUpdateUser(): UseMutationResult<
  AdminUserDetail,
  Error,
  { id: string; payload: UpdateUserPayload }
> {
  const queryClient = useQueryClient();
  return useMutation<AdminUserDetail, Error, { id: string; payload: UpdateUserPayload }>({
    mutationFn: ({ id, payload }) => usersApi.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.users.all });
    },
  });
}

/** POST /admin/users/:id/<action> — verify/suspend/unsuspend/…/force-logout. */
export function useUserAction(): UseMutationResult<
  AdminActionResult,
  Error,
  { id: string; action: UserAction; reason?: string }
> {
  const queryClient = useQueryClient();
  return useMutation<AdminActionResult, Error, { id: string; action: UserAction; reason?: string }>(
    {
      mutationFn: ({ id, action, reason }) => usersApi.action(id, action, reason),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: qk.users.all });
      },
    },
  );
}

/** POST /admin/users/bulk-actions — bulk verify/suspend/activate/deactivate/force_logout/export. */
export function useBulkUserAction(): UseMutationResult<
  BulkActionResult,
  Error,
  { action: BulkAction; userIds: string[]; reason?: string }
> {
  const queryClient = useQueryClient();
  return useMutation<
    BulkActionResult,
    Error,
    { action: BulkAction; userIds: string[]; reason?: string }
  >({
    mutationFn: ({ action, userIds, reason }) => usersApi.bulk(action, userIds, reason),
    onSuccess: (_result, variables) => {
      // 'export' does not mutate state — skip the invalidation churn.
      if (variables.action !== 'export') {
        void queryClient.invalidateQueries({ queryKey: qk.users.all });
      }
    },
  });
}
