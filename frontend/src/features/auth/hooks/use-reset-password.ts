import { useMutation } from '@tanstack/react-query';

import { authApi } from '../api/auth.api';
import type { ResetPasswordPayload } from '../types/auth.types';

/**
 * `POST /auth/reset-password`. An invalid/expired/used token → `AUTH_RESET_INVALID` (400); a
 * policy-failing password → `AUTH_PASSWORD_WEAK` (422). The page maps these to the field/banner.
 */
export function useResetPassword() {
  return useMutation({
    mutationFn: (payload: ResetPasswordPayload) => authApi.resetPassword(payload),
  });
}
