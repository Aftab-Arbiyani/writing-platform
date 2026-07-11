import { describe, expect, it } from 'vitest';

import { mediaUrl } from './media';

describe('mediaUrl', () => {
  it('returns undefined for empty keys', () => {
    expect(mediaUrl(null)).toBeUndefined();
    expect(mediaUrl(undefined)).toBeUndefined();
    expect(mediaUrl('')).toBeUndefined();
  });

  it('passes absolute URLs through unchanged', () => {
    expect(mediaUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
  });

  it('joins a key onto the base, tolerating a leading slash', () => {
    // No VITE_CDN_URL in tests → falls back to the VITE_API_URL origin.
    expect(mediaUrl('avatars/u1.jpg')).toBe('http://localhost:4000/avatars/u1.jpg');
    expect(mediaUrl('/avatars/u1.jpg')).toBe('http://localhost:4000/avatars/u1.jpg');
  });
});
