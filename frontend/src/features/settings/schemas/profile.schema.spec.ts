import { describe, expect, it } from 'vitest';

import { profileSchema, type ProfileFormInput } from './profile.schema';

const base: ProfileFormInput = {
  penName: 'Meera',
  bio: '',
  location: '',
  websiteUrl: '',
  isPrivate: false,
  defaultLanguageCode: '',
  genres: [],
  socialLinks: [],
};

describe('profileSchema', () => {
  it('accepts a minimal valid profile', () => {
    expect(profileSchema.safeParse(base).success).toBe(true);
  });

  it('requires a pen name', () => {
    expect(profileSchema.safeParse({ ...base, penName: '' }).success).toBe(false);
  });

  it('rejects a pen name over 50 characters', () => {
    expect(profileSchema.safeParse({ ...base, penName: 'x'.repeat(51) }).success).toBe(false);
  });

  it('accepts an empty website (unchanged) but rejects a malformed one', () => {
    expect(profileSchema.safeParse({ ...base, websiteUrl: '' }).success).toBe(true);
    expect(profileSchema.safeParse({ ...base, websiteUrl: 'https://ok.dev' }).success).toBe(true);
    expect(profileSchema.safeParse({ ...base, websiteUrl: 'not a url' }).success).toBe(false);
  });

  it('caps genres at 5', () => {
    const six = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(profileSchema.safeParse({ ...base, genres: six }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, genres: six.slice(0, 5) }).success).toBe(true);
  });

  it('validates social links: http(s) url + non-empty platform', () => {
    expect(
      profileSchema.safeParse({
        ...base,
        socialLinks: [{ platform: 'twitter', url: 'https://x.com/meera' }],
      }).success,
    ).toBe(true);
    expect(
      profileSchema.safeParse({
        ...base,
        socialLinks: [{ platform: 'twitter', url: 'ftp://nope' }],
      }).success,
    ).toBe(false);
    expect(
      profileSchema.safeParse({
        ...base,
        socialLinks: [{ platform: '', url: 'https://x.com' }],
      }).success,
    ).toBe(false);
  });
});
