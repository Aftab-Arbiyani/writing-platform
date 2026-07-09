import { describe, expect, it } from 'vitest';

import { parseHandle, profilePath } from './routes';

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
