/**
 * Admin auth wire types — mirror the backend auth DTOs (`AuthResponseDto`, `LoginDto`). Hand-declared
 * until `@qalam/api-types` emits generated types (it ships only the `AuthTokens` placeholder today).
 * The web client receives the refresh token as an httpOnly cookie, so only `accessToken` crosses the
 * JSON boundary; `refreshToken` is mobile-only and never present here.
 */
export interface LoginUser {
  id: string;
  email: string;
  username: string;
  isEmailVerified: boolean;
}

export interface AuthResponse {
  user: LoginUser;
  accessToken: string;
  refreshToken?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}
