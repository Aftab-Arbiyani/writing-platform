import { useMutation, useQueryClient } from '@tanstack/react-query';

import { STORAGE_KEYS } from '@/lib/constants';
import { local } from '@/lib/storage';
import { useAuthStore } from '@/stores/auth.store';

import { authApi } from '../api/auth.api';

/**
 * `POST /auth/logout`. Clears local session state on settle (success OR failure — even if the
 * server call errors, e.g. the token already expired, the user still wants to be signed out):
 * drop the access token, clear the user-scoped query cache, and reset session state. The theme
 * store survives (docs/32 §3.2). Navigation is the caller's.
 *
 * `queryClient.clear()` handles every cached server read, but the AF5 entitlement snapshot is also
 * mirrored into `localStorage` so premium gating survives a reload and being offline — and that copy
 * outlives the query cache, so it is dropped explicitly. It is the one user-scoped key in
 * `STORAGE_KEYS`; the device-scoped ones (theme, recent searches, reader typography) belong to the
 * browser and stay. Removed by key rather than through monetization's own `clearCachedEntitlements`,
 * because a feature may not import another feature (docs/26 §4).
 */
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      useAuthStore.getState().clear();
      queryClient.clear();
      local.remove(STORAGE_KEYS.entitlements);
    },
  });
}
