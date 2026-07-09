import { Role } from '@qalam/shared';
import { describe, expect, it } from 'vitest';

import { decodeAccessToken, isAccessTokenExpired } from './jwt';

/** Build a JWT-shaped string with a base64url payload (signature is irrelevant here). */
function makeToken(payload: Record<string, unknown>): string {
  const b64url = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.sig`;
}

describe('decodeAccessToken', () => {
  it('decodes the role and subject from a well-formed token', () => {
    const token = makeToken({ sub: 'user-1', role: Role.Admin, sv: 3, jti: 'j' });
    const decoded = decodeAccessToken(token);
    expect(decoded).toEqual({ sub: 'user-1', role: Role.Admin, sv: 3, exp: undefined });
  });

  it('falls back to the least-privileged role when the claim is unknown/absent', () => {
    expect(decodeAccessToken(makeToken({ sub: 'u', role: 'wizard' }))?.role).toBe(Role.User);
    expect(decodeAccessToken(makeToken({ sub: 'u' }))?.role).toBe(Role.User);
  });

  it('returns null for null, empty, or non-JWT input', () => {
    expect(decodeAccessToken(null)).toBeNull();
    expect(decodeAccessToken('')).toBeNull();
    expect(decodeAccessToken('not-a-jwt')).toBeNull();
    expect(decodeAccessToken('only.two')).toBeNull();
  });

  it('returns null when the payload has no subject', () => {
    expect(decodeAccessToken(makeToken({ role: Role.User }))).toBeNull();
  });
});

describe('isAccessTokenExpired', () => {
  it('is true for an absent token or one with no exp', () => {
    expect(isAccessTokenExpired(null)).toBe(true);
    expect(isAccessTokenExpired(makeToken({ sub: 'u', role: Role.User }))).toBe(true);
  });

  it('reflects a future vs past exp', () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const past = Math.floor(Date.now() / 1000) - 3600;
    expect(isAccessTokenExpired(makeToken({ sub: 'u', role: Role.User, exp: future }))).toBe(false);
    expect(isAccessTokenExpired(makeToken({ sub: 'u', role: Role.User, exp: past }))).toBe(true);
  });
});
