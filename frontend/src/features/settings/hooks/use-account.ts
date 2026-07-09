import { Role } from '@qalam/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { decodeAccessToken } from '@/lib/jwt';
import { useAuthStore } from '@/stores/auth.store';

import { accountApi, type ChangePasswordPayload } from '../api/account.api';

/**
 * Change password (`POST /auth/change-password`). The server revokes every OTHER session and
 * rotates THIS one, returning a fresh access token — the hook adopts it (decoding the role hint,
 * docs/26 §8) so the current session stays valid. The refresh cookie is rotated server-side.
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: (payload: ChangePasswordPayload) => accountApi.changePassword(payload),
    onSuccess: ({ accessToken }) => {
      const decoded = decodeAccessToken(accessToken);
      useAuthStore.getState().setSession({ accessToken, role: decoded?.role ?? Role.User });
    },
  });
}

/**
 * Sign out everywhere (`POST /auth/logout-all`). This revokes ALL sessions including the current
 * one's refresh cookie, so — like a manual logout — we drop local state and clear the user-scoped
 * cache on settle (theme survives, docs/32 §3). Navigation to sign-in is the caller's.
 */
export function useLogoutAll() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => accountApi.logoutAll(),
    onSettled: () => {
      useAuthStore.getState().clear();
      client.clear();
    },
  });
}
