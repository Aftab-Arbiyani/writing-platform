import { describe, expect, it } from 'vitest';

import { draftPath, parseHandle, profilePath } from './routes';

/**
 * `draftPath` is the cross-feature seam W7a needed: writing a response creates a linked draft and
 * the flow ends in the editor, which the reader may not import (docs/26 §4). Route composition is
 * the way across, so the route has to be addressable by name and correct.
 */
describe('draftPath', () => {
  it('addresses an existing draft in the editor', () => {
    expect(draftPath('0197d2f4-1c3a-7000-8000-000000000001')).toBe(
      '/write/0197d2f4-1c3a-7000-8000-000000000001',
    );
  });

  it('encodes the id rather than pasting it into the path', () => {
    expect(draftPath('a b/c')).toBe('/write/a%20b%2Fc');
  });
});

describe('profilePath', () => {
  it('mints an @handle path and encodes it', () => {
    expect(profilePath('meera_k')).toBe('/@meera_k');
    expect(profilePath('a b')).toBe('/@a%20b');
  });
});

describe('parseHandle', () => {
  it('unwraps a valid @handle to its username', () => {
    expect(parseHandle('@meera_k')).toBe('meera_k');
  });

  it('rejects a handle without the @ prefix', () => {
    expect(parseHandle('meera_k')).toBeNull();
    expect(parseHandle(undefined)).toBeNull();
  });

  it('rejects an empty handle', () => {
    expect(parseHandle('@')).toBeNull();
  });

  it('rejects reserved words (real routes never resolve as profiles)', () => {
    expect(parseHandle('@settings')).toBeNull();
    expect(parseHandle('@feed')).toBeNull();
    expect(parseHandle('@me')).toBeNull();
  });
});
