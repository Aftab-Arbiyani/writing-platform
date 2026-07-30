import type { Role } from '@qalam/shared';

/**
 * Access-token claims (docs 13 §3.2) — `sub`, `role` (RBAC cache; DB is truth on
 * admin routes), `sv` (session version, §3.6), `jti`, plus standard `iat`/`exp`.
 * **Nothing else** — no email, username, or profile data ever goes in a JWT
 * (§3.2, and Sentry/Pino scrubbing depends on it).
 */
export interface AccessTokenPayload {
  sub: string;
  role: Role;
  /** Session version — mismatch = revoked by "log out everywhere" (§3.6). */
  sv: number;
  jti: string;
  iat?: number;
  exp?: number;
}

/**
 * Refresh-token claims (docs 13 §3.2). The token is a signed JWT; its liveness
 * is tracked statefully in Redis DB 3 by `jti`/`familyId` (rotation + reuse
 * detection). Signed with `JWT_REFRESH_SECRET` (separate from access).
 */
export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  familyId: string;
  iat?: number;
  exp?: number;
}
