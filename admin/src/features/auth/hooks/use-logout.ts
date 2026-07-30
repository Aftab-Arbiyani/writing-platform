import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { setRemember } from '@/lib/remember';
import { useAuthStore } from '@/stores/auth.store';

import { authApi } from '../api/auth.api';

/**
 * Logout mutation (docs/32 §3, security: clear session on logout). Cleanup runs in `onSettled` so a
 * flaky network still ends the local session: drop remember-me, clear the auth store (token + role),
 * and wipe the query cache (no stale operator data survives). Redirect follows automatically — the
 * store goes anonymous, so `RequireAuth` bounces to /login.
 */
export function useLogout(): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      setRemember(false);
      useAuthStore.getState().clear();
      queryClient.clear();
    },
  });
}
