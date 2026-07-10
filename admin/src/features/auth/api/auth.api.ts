import type { AuthTokens } from '@qalam/api-types';

import { api } from '@/lib/api-client';

import type { AuthResponse, LoginPayload } from '../types/auth.types';

/**
 * The auth feature's `api/` layer — the only place these endpoints are named (docs/32 §10). All go
 * through the shared `api-client` (fetch wrapper with the auth interceptor + single-flight refresh);
 * no HTTP config is duplicated. Refresh sends an EMPTY body — the httpOnly `qalam_rt` cookie rides
 * along (docs/32 §3). Callers receive the unwrapped `data` (never the envelope).
 */
export const authApi = {
  /** POST /auth/login — returns the access token (in-memory) + sets the refresh cookie. */
  login: (payload: LoginPayload): Promise<AuthResponse> =>
    api.post<AuthResponse>('/auth/login', payload).then((result) => result.data),

  /** POST /auth/refresh — rotates the session; returns a fresh access token. Cookie-driven. */
  refresh: (): Promise<AuthTokens> =>
    api.post<AuthTokens>('/auth/refresh').then((result) => result.data),

  /** POST /auth/logout — 204; revokes the token family + clears the cookie server-side. */
  logout: (): Promise<void> => api.post<undefined>('/auth/logout').then(() => undefined),
};
