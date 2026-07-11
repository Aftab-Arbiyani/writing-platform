import { afterEach, describe, expect, it } from 'vitest';

import { useAnalyticsFilters } from './analytics-filters.store';

afterEach(() => useAnalyticsFilters.getState().reset());

describe('analytics filters store', () => {
  it('sets a range preset', () => {
    useAnalyticsFilters.getState().setRange('7d');
    expect(useAnalyticsFilters.getState().range).toBe('7d');
  });

  it('sets a custom range', () => {
    useAnalyticsFilters.getState().setCustom('2026-01-01', '2026-02-01');
    const state = useAnalyticsFilters.getState();
    expect(state.range).toBe('custom');
    expect(state.from).toBe('2026-01-01');
    expect(state.to).toBe('2026-02-01');
  });

  it('sets and clears a filter (empty string → undefined)', () => {
    useAnalyticsFilters.getState().setFilter('language', 'hi');
    expect(useAnalyticsFilters.getState().language).toBe('hi');
    useAnalyticsFilters.getState().setFilter('language', '');
    expect(useAnalyticsFilters.getState().language).toBeUndefined();
  });

  it('reset restores the defaults', () => {
    useAnalyticsFilters.getState().setCustom('a', 'b');
    useAnalyticsFilters.getState().setFilter('genre', 'poetry');
    useAnalyticsFilters.getState().reset();
    const state = useAnalyticsFilters.getState();
    expect(state.range).toBe('30d');
    expect(state.from).toBeUndefined();
    expect(state.genre).toBeUndefined();
  });
});
