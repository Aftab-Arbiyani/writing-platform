import { useMutation } from '@tanstack/react-query';

import { authApi } from '../api/auth.api';
import { establishSession } from '../lib/session';
import type { LoginPayload } from '../types/auth.types';

/**
 * `POST /auth/login`. On success the access token + role hint + verified flag land in the
 * session store (docs/12 §7). Navigation (returnTo) and error mapping stay in the page
 * (docs/33 §7) so the hook is routing-agnostic and testable.
 */
export function useLogin() {
  return useMutation({
    mutationFn: (payload: LoginPayload) => authApi.login(payload),
    onSuccess: (data) => {
      establishSession(data.accessToken, data.user.isEmailVerified);
    },
  });
}
