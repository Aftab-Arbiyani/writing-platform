import { describe, expect, it } from 'vitest';

import { resolveTimeRange } from './time-range';

const now = new Date('2026-07-10T12:00:00.000Z');

describe('resolveTimeRange', () => {
  it('ends every rolling window at now', () => {
    expect(resolveTimeRange('7d', now).to).toBe(now.toISOString());
    expect(resolveTimeRange('30d', now).to).toBe(now.toISOString());
  });

  it('uses a 7 vs 30 day span', () => {
    const week = resolveTimeRange('7d', now);
    const month = resolveTimeRange('30d', now);
    expect(new Date(week.from).getTime()).toBeLessThan(now.getTime());
    expect(new Date(month.from).getTime()).toBeLessThan(new Date(week.from).getTime());
  });

  it('today starts at local midnight', () => {
    const window = resolveTimeRange('today', now);
    expect(new Date(window.from).getHours()).toBe(0);
    expect(window.to).toBe(now.toISOString());
  });

  it('custom honors provided bounds, falling back to 7d when unset', () => {
    const custom = resolveTimeRange('custom', now, { from: '2026-01-01', to: '2026-02-01' });
    expect(custom.from).toContain('2026-01-01');
    const fallback = resolveTimeRange('custom', now, { from: null, to: null });
    expect(new Date(fallback.from).getTime()).toBeLessThan(now.getTime());
  });
});
