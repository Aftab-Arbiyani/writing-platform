import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth.store';

import { authApi } from '../api/auth.api';

/**
 * `POST /auth/logout`. Clears local session state on settle (success OR failure — even if the
 * server call errors, e.g. the token already expired, the user still wants to be signed out):
 * drop the access token, clear the user-scoped query cache, and reset session state. The theme
 * store survives (docs/32 §3.2). Navigation is the caller's.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      useAuthStore.getState().clear();
      queryClient.clear();
    },
  });
}
