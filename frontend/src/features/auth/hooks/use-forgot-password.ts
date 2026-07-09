import { useMutation } from '@tanstack/react-query';

import { authApi } from '../api/auth.api';
import type { ForgotPasswordPayload } from '../types/auth.types';

/**
 * `POST /auth/forgot-password`. Always resolves 202 whether or not the email exists (no account
 * enumeration, docs/13 §3.1) — the page shows the same "check your inbox" confirmation either
 * way. Rate-limited server-side (429 → calm banner).
 */
export function useForgotPassword() {
  return useMutation({
    mutationFn: (payload: ForgotPasswordPayload) => authApi.forgotPassword(payload),
  });
}
