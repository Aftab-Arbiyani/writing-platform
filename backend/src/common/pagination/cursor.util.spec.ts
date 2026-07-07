import { decodeCursor, encodeCursor } from './cursor.util';
import type { CursorPayload } from './cursor.util';

/**
 * Pure-function unit tests (docs 16 §7 — utils are mandatory, cheapest tests we
 * own). No infra. Also seeds the backend unit-test suite so `pnpm test` runs a
 * real spec instead of `--passWithNoTests`.
 */
describe('cursor.util', () => {
  it('round-trips a payload through encode → decode', () => {
    const payload: CursorPayload = {
      k: '2026-07-04T18:30:00.000Z',
      id: '0198c9a1-7e2b-7cc3-9f1a-2b4d8e6f0a11',
    };

    const decoded = decodeCursor(encodeCursor(payload));

    expect(decoded).toEqual(payload);
  });

  it('produces a URL-safe (base64url) cursor with no +/=/ characters', () => {
    const cursor = encodeCursor({ k: 'a?b/c+d', id: 'x'.repeat(30) });

    expect(cursor).not.toMatch(/[+/=]/);
  });

  it.each([undefined, null, ''])('returns null for the empty cursor %p', (raw) => {
    expect(decodeCursor(raw)).toBeNull();
  });

  it('returns null for a non-base64 / non-JSON cursor', () => {
    expect(decodeCursor('!!!not-base64!!!')).toBeNull();
  });

  it('returns null when the decoded shape is missing k/id', () => {
    const bad = Buffer.from(JSON.stringify({ k: 'only-k' }), 'utf8').toString('base64url');

    expect(decodeCursor(bad)).toBeNull();
  });

  it('returns null when k/id are not strings', () => {
    const bad = Buffer.from(JSON.stringify({ k: 1, id: 2 }), 'utf8').toString('base64url');

    expect(decodeCursor(bad)).toBeNull();
  });
});
