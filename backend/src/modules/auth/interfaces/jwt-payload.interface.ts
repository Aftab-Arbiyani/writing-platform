/**
 * Claims carried by a Qalam JWT access token (ADR §3). Signed by the auth
 * module (Epic 1 t4) and verified by `JwtStrategy`. `sub` is the user id;
 * standard `iat`/`exp` are added by `@nestjs/jwt` at sign time.
 *
 * Kept minimal on purpose: authorization data (roles) is resolved server-side
 * from the RBAC tables (E10), not trusted from the token.
 */
export interface JwtPayload {
  /** Subject — the user's id. */
  sub: string;
  /** Issued-at (unix seconds), set by the signer. */
  iat?: number;
  /** Expiry (unix seconds), set by the signer. */
  exp?: number;
}
