import { useMutation } from '@tanstack/react-query';

import { authApi } from '../api/auth.api';

/**
 * `POST /auth/resend-verification` (Bearer required — resends to the *current* user). Only
 * usable while signed in; a signed-out visitor on the pending screen is told to sign in first.
 */
export function useResendVerification() {
  return useMutation({
    mutationFn: () => authApi.resendVerification(),
  });
}
