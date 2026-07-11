import { Role } from '@qalam/shared';
import { describe, expect, it } from 'vitest';

import { decodeAccessToken } from '@/lib/jwt';

/** Build an unsigned JWT (`header.payload.sig`) with the given claims — signature is never verified. */
function makeToken(claims: Record<string, unknown>): string {
  const b64 = (obj: object): string =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}.sig`;
}

describe('decodeAccessToken', () => {
  it('extracts sub, role, sv, and exp', () => {
    const token = makeToken({ sub: 'u1', role: Role.Admin, sv: 3, exp: 9999999999 });
    const decoded = decodeAccessToken(token);
    expect(decoded).toEqual({ sub: 'u1', role: Role.Admin, sv: 3, exp: 9999999999 });
  });

  it('falls back to least privilege (User) for an unknown/absent role', () => {
    expect(decodeAccessToken(makeToken({ sub: 'u1', role: 'wizard' }))?.role).toBe(Role.User);
    expect(decodeAccessToken(makeToken({ sub: 'u1' }))?.role).toBe(Role.User);
  });

  it('returns null for a malformed token or missing sub', () => {
    expect(decodeAccessToken('not-a-jwt')).toBeNull();
    expect(decodeAccessToken(makeToken({ role: Role.Admin }))).toBeNull(); // no sub
  });
});
