import { Visibility } from '@qalam/shared';
import { describe, expect, it } from 'vitest';

import { publishSchema } from './publish.schema';

const base = {
  title: 'A door never opened',
  subtitle: '',
  featuredQuote: '',
  languageCode: 'ur',
  genreSlug: 'ghazal',
  tags: ['barish'],
  visibility: Visibility.Public,
  scheduleEnabled: false,
  scheduledAt: '',
};

describe('publishSchema', () => {
  it('accepts a complete publish payload', () => {
    expect(publishSchema.safeParse(base).success).toBe(true);
  });

  it('requires a title, a language, and a genre', () => {
    expect(publishSchema.safeParse({ ...base, title: '  ' }).success).toBe(false);
    expect(publishSchema.safeParse({ ...base, languageCode: '' }).success).toBe(false);
    expect(publishSchema.safeParse({ ...base, genreSlug: '' }).success).toBe(false);
  });

  it('caps tags at five', () => {
    const result = publishSchema.safeParse({ ...base, tags: ['a', 'b', 'c', 'd', 'e', 'f'] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'tags')).toBe(true);
    }
  });

  it('requires a future date when scheduling is enabled', () => {
    // The field is a datetime-local (local wall-clock); build it the same way the input does.
    const localInput = (offsetMs: number): string => {
      const d = new Date(Date.now() + offsetMs);
      const pad = (n: number): string => String(n).padStart(2, '0');
      return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    const twoDays = 2 * 24 * 3600 * 1000;
    expect(
      publishSchema.safeParse({ ...base, scheduleEnabled: true, scheduledAt: localInput(-twoDays) })
        .success,
    ).toBe(false);
    expect(
      publishSchema.safeParse({ ...base, scheduleEnabled: true, scheduledAt: localInput(twoDays) })
        .success,
    ).toBe(true);
  });

  it('ignores the schedule date when scheduling is off', () => {
    expect(
      publishSchema.safeParse({ ...base, scheduleEnabled: false, scheduledAt: '' }).success,
    ).toBe(true);
  });
});
