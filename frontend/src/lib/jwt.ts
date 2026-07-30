import { Role } from '@qalam/shared';

/**
 * Client-side access-token decode — a **UX hint only** (docs/26 §8, docs/12 §7). The server
 * is always authoritative on authorization; we read `role`/`exp` purely to render the right
 * chrome without a round-trip. The signature is NOT verified here (the browser cannot, and
 * must not, hold the signing secret). Never gate a security decision on this.
 *
 * Access-token claims mirror the backend `AccessTokenPayload` (docs 13 §3.2):
 * `{ sub, role, sv, jti, iat?, exp? }`. Nothing sensitive (no email/username) is ever in a JWT.
 */
export interface DecodedAccessToken {
  sub: string;
  role: Role;
  sv: number;
  exp?: number;
}

const ROLE_VALUES = new Set<string>(Object.values(Role));

/** base64url → JSON, tolerant of missing padding. Returns null on any malformation. */
function decodeSegment(segment: string): unknown {
  try {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Decode an access token's claims, or null if it is malformed / not a JWT. */
export function decodeAccessToken(token: string | null | undefined): DecodedAccessToken | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [, payloadSegment] = parts;
  if (!payloadSegment) return null;

  const payload = decodeSegment(payloadSegment);
  if (payload === null || typeof payload !== 'object') return null;

  const claims = payload as Record<string, unknown>;
  if (typeof claims.sub !== 'string') return null;

  // Role is a hint; if the claim is absent/unknown, fall back to the least-privileged role
  // (the server still enforces the real role on every request).
  const role =
    typeof claims.role === 'string' && ROLE_VALUES.has(claims.role)
      ? (claims.role as Role)
      : Role.User;

  return {
    sub: claims.sub,
    role,
    sv: typeof claims.sv === 'number' ? claims.sv : 0,
    exp: typeof claims.exp === 'number' ? claims.exp : undefined,
  };
}

/** True when the token is absent or its `exp` is in the past (with a small skew allowance). */
export function isAccessTokenExpired(token: string | null | undefined, skewSeconds = 10): boolean {
  const decoded = decodeAccessToken(token);
  if (!decoded?.exp) return true;
  return decoded.exp * 1000 <= Date.now() - skewSeconds * 1000;
}
