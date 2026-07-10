import { describe, expect, it } from 'vitest';

import { formatDurationLong, formatDurationShort, formatPercent } from './format-metrics';

describe('formatPercent', () => {
  it('rounds a 0–1 ratio to a whole percent', () => {
    expect(formatPercent(0.653)).toBe('65%');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(1)).toBe('100%');
  });
  it('guards non-finite input', () => {
    expect(formatPercent(Number.NaN)).toBe('0%');
  });
});

describe('formatDurationShort', () => {
  it('formats sub-minute, minute, and hour ranges', () => {
    expect(formatDurationShort(45)).toBe('45s');
    expect(formatDurationShort(312)).toBe('5m 12s');
    expect(formatDurationShort(300)).toBe('5m');
    expect(formatDurationShort(3660)).toBe('1h 1m');
  });
});

describe('formatDurationLong', () => {
  it('formats large totals in hours', () => {
    expect(formatDurationLong(1123200)).toBe('312h');
    expect(formatDurationLong(5400)).toBe('1.5h');
    expect(formatDurationLong(600)).toBe('10m');
  });
});
