import { Role } from '@qalam/shared';

/**
 * Access-token JWT decoding — a UX-hint parser, NOT verification (docs/26 §8). The signature is
 * never checked client-side; the server re-validates every request. We only read the `role` claim
 * (the sole source of role — `/me` doesn't return it) and `exp` for display/expiry heuristics.
 *
 * Kept admin-local: the reader has its own copy (`frontend/src/lib/jwt.ts`) that A2 cannot touch,
 * and the shared *vocabulary* (`Role`) already lives in `@qalam/shared`. Extracting the parser to a
 * package would leave the reader's duplicate in place (frontend is out of scope), so it stays here.
 */
export interface DecodedAccessToken {
  sub: string;
  role: Role;
  sv: number;
  exp?: number;
}

const KNOWN_ROLES = new Set<string>(Object.values(Role));

function base64UrlToJson(segment: string): unknown {
  try {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64)) as unknown;
  } catch {
    return null;
  }
}

export function decodeAccessToken(token: string): DecodedAccessToken | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const payload = base64UrlToJson(parts[1] ?? '');
  if (typeof payload !== 'object' || payload === null) return null;

  const claims = payload as Record<string, unknown>;
  if (typeof claims.sub !== 'string') return null;

  // Unknown/absent role → least privilege (User), never a guess that grants access.
  const role =
    typeof claims.role === 'string' && KNOWN_ROLES.has(claims.role)
      ? (claims.role as Role)
      : Role.User;

  return {
    sub: claims.sub,
    role,
    sv: typeof claims.sv === 'number' ? claims.sv : 0,
    exp: typeof claims.exp === 'number' ? claims.exp : undefined,
  };
}
