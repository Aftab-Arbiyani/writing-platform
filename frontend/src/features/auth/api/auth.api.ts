import { post } from '@/lib/api-client';

import type {
  AuthResponse,
  ForgotPasswordPayload,
  GoogleExchangePayload,
  GoogleExchangeResponse,
  LoginPayload,
  RegisterPayload,
  ResetPasswordPayload,
  TokenResponse,
  VerifyEmailPayload,
} from '../types/auth.types';

/**
 * The auth `api/` layer — the ONLY place auth endpoints are named (docs/32 §10). Hooks call
 * these; components never call the client directly. Every method resolves the unwrapped
 * `data` payload (the client strips the envelope) or throws a typed `ApiError`.
 *
 * `refresh`/`logout` carry no body: the web client sends its refresh token as the httpOnly
 * cookie via `credentials:'include'` (docs/32 §3). The two Google endpoints (`/auth/google`,
 * `/auth/google/callback`) are top-level redirects, not fetches — see `startGoogleLogin`.
 */
export const authApi = {
  login: (payload: LoginPayload, signal?: AbortSignal) =>
    post<AuthResponse>('/auth/login', payload, { signal }),

  register: (payload: RegisterPayload, signal?: AbortSignal) =>
    post<AuthResponse>('/auth/register', payload, { signal }),

  /** Boot / silent session restore. 401 (no or expired cookie) is normal → visitor mode. */
  refresh: (signal?: AbortSignal) => post<TokenResponse>('/auth/refresh', undefined, { signal }),

  /** Revoke the current session (Bearer required). Returns 204 → undefined. */
  logout: () => post<void>('/auth/logout'),

  forgotPassword: (payload: ForgotPasswordPayload, signal?: AbortSignal) =>
    post<{ sent: true }>('/auth/forgot-password', payload, { signal }),

  resetPassword: (payload: ResetPasswordPayload, signal?: AbortSignal) =>
    post<{ reset: true }>('/auth/reset-password', payload, { signal }),

  verifyEmail: (payload: VerifyEmailPayload, signal?: AbortSignal) =>
    post<{ verified: true }>('/auth/verify-email', payload, { signal }),

  /** Resend the verification email to the current user (Bearer required). */
  resendVerification: () => post<{ sent: true }>('/auth/resend-verification'),

  /** Exchange the one-time OAuth code (from `/auth/callback?code=`) for an access token. */
  googleExchange: (payload: GoogleExchangePayload, signal?: AbortSignal) =>
    post<GoogleExchangeResponse>('/auth/google/exchange', payload, { signal }),
};
