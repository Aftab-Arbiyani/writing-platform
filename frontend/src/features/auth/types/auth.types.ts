/**
 * Auth wire types (docs/32 §10). These mirror the frozen `v1` auth DTOs
 * (`backend/src/modules/auth/dto/*`). They live here because `@qalam/api-types` still ships
 * only the placeholder `AuthTokens` — once the backend emits `openapi.json` and
 * `@qalam/api-types` is regenerated, replace these with the generated types (CI guards drift,
 * docs/05 §10). The web app never receives `refreshToken` in the body (httpOnly cookie,
 * docs/13 §3.3); it is typed optional only to match the shared contract.
 */

export interface UserSummary {
  id: string;
  email: string;
  username: string;
  isEmailVerified: boolean;
}

export interface AuthResponse {
  user: UserSummary;
  accessToken: string;
  /** Mobile only; web uses an httpOnly cookie. */
  refreshToken?: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
}

export interface GoogleExchangeResponse {
  accessToken: string;
}

// ── Request payloads ────────────────────────────────────────────────────────

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  username: string;
  password: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
}

export interface VerifyEmailPayload {
  token: string;
}

export interface GoogleExchangePayload {
  code: string;
}
