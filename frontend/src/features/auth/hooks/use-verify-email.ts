import { useMutation } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth.store';

import { authApi } from '../api/auth.api';

/**
 * `POST /auth/verify-email` with the token from the emailed link (public). On success, if the
 * user happens to be signed in (just registered), reflect the verified flag in the store so any
 * "please verify" nudge clears. An invalid/expired token → `AUTH_VERIFICATION_INVALID`.
 */
export function useVerifyEmail() {
  return useMutation({
    mutationFn: (token: string) => authApi.verifyEmail({ token }),
    onSuccess: () => {
      const store = useAuthStore.getState();
      if (store.status === 'authenticated') store.setEmailVerified(true);
    },
  });
}
