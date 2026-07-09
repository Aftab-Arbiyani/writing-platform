import { describe, expect, it } from 'vitest';

import { formatCount, formatRelativeTime } from './format';

describe('formatCount', () => {
  it('compacts thousands', () => {
    expect(formatCount(1200)).toBe('1.2K');
  });

  it('leaves small numbers as-is', () => {
    expect(formatCount(42)).toBe('42');
  });
});

describe('formatRelativeTime', () => {
  it('says "just now" for the current time', () => {
    expect(formatRelativeTime(new Date())).toBe('just now');
  });

  it('formats a few hours ago compactly', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(formatRelativeTime(threeHoursAgo)).toBe('3h');
  });
});
