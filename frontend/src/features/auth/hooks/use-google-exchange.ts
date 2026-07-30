import { useMutation } from '@tanstack/react-query';

import { authApi } from '../api/auth.api';
import { establishSession } from '../lib/session';

/**
 * `POST /auth/google/exchange` — trades the one-time OAuth code (from `/auth/callback?code=`)
 * for an access token and establishes the session (docs/32 §3.3). `isEmailVerified` is unknown
 * from this response (Google accounts are verified upstream) → passed as null.
 */
export function useGoogleExchange() {
  return useMutation({
    mutationFn: (code: string) => authApi.googleExchange({ code }),
    onSuccess: (data) => {
      establishSession(data.accessToken, null);
    },
  });
}
