import { useMutation } from '@tanstack/react-query';

import { authApi } from '../api/auth.api';
import { establishSession } from '../lib/session';
import type { RegisterPayload } from '../types/auth.types';

/**
 * `POST /auth/register`. Registration signs the user in immediately (the response carries an
 * access token) with `isEmailVerified: false`; the page then routes to the verification-pending
 * screen. Only `{ email, username, password }` is sent — the frozen `v1` contract has no
 * pen-name/display-name field (that is E2/profiles).
 */
export function useRegister() {
  return useMutation({
    mutationFn: (payload: RegisterPayload) => authApi.register(payload),
    onSuccess: (data) => {
      establishSession(data.accessToken, data.user.isEmailVerified);
    },
  });
}
