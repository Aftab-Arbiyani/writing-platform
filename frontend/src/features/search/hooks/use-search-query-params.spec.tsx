import { SearchSort, SearchType } from '@qalam/shared';
import { act, renderHook } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { useSearchQueryParams } from './use-search-query-params';

function wrapperFor(initialEntry: string) {
  return function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>;
  };
}

describe('useSearchQueryParams', () => {
  it('resolves the query, tab, and filters from the URL', () => {
    const { result } = renderHook(() => useSearchQueryParams(), {
      wrapper: wrapperFor('/search?q=barish&type=pieces&read=short&lang=ur'),
    });
    expect(result.current.q).toBe('barish');
    expect(result.current.hasQuery).toBe(true);
    expect(result.current.type).toBe(SearchType.Pieces);
    expect(result.current.filters).toMatchObject({ language: 'ur', maxReadingTime: 300 });
  });

  it('treats a single-character query as too short', () => {
    const { result } = renderHook(() => useSearchQueryParams(), {
      wrapper: wrapperFor('/search?q=a'),
    });
    expect(result.current.hasQuery).toBe(false);
  });

  it('omits the default relevance sort from the wire filters', () => {
    const { result } = renderHook(() => useSearchQueryParams(), {
      wrapper: wrapperFor('/search?q=barish&type=pieces'),
    });
    expect(result.current.filters.sort).toBeUndefined();
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('switches the tab via the URL', () => {
    const { result } = renderHook(() => useSearchQueryParams(), {
      wrapper: wrapperFor('/search?q=barish&type=pieces'),
    });
    act(() => {
      result.current.setType(SearchType.Writers);
    });
    expect(result.current.type).toBe(SearchType.Writers);
  });

  /**
   * The W5-7 hazard, kept alive after the bug that revealed it was removed.
   *
   * Two `update` calls in one handler both patch the same pre-navigation URL, so the second discards
   * the first's key. It was found on `setMode` + `setQuery`, and D5 deleted `mode` — but the hazard
   * belongs to `update`, not to `mode`, so the case is re-arranged on two setters that still exist
   * rather than deleted with the parameter. A future handler that sets two keys will meet it again.
   */
  it('drops one of two keys when they are set in separate calls — the shape that broke', () => {
    const { result } = renderHook(() => useSearchQueryParams(), {
      wrapper: wrapperFor('/search'),
    });
    act(() => {
      result.current.setType(SearchType.Writers);
      result.current.setQuery('barish');
    });
    // Documents the hazard rather than endorsing it: both setters patched the same snapshot, so the
    // scope is gone. Any caller needing both must patch them in ONE `update`.
    expect(result.current.q).toBe('barish');
    expect(result.current.type).toBe(SearchType.All);
  });

  /**
   * D5 merged the two engines. Links carrying the old `mode=ai` are in readers' bookmarks and in
   * saved searches, and they must still land on the results that parameter used to select — which
   * they do by being ignored, since the ranked results are now the default.
   */
  it('ignores a legacy mode= parameter instead of breaking on it', () => {
    const { result } = renderHook(() => useSearchQueryParams(), {
      wrapper: wrapperFor('/search?q=barish&mode=ai'),
    });
    expect(result.current.q).toBe('barish');
    expect(result.current.type).toBe(SearchType.All);
    expect(result.current.hasQuery).toBe(true);
  });

  it('adds an explicit sort to the filters when changed', () => {
    const { result } = renderHook(() => useSearchQueryParams(), {
      wrapper: wrapperFor('/search?q=barish&type=pieces'),
    });
    act(() => {
      result.current.setSort(SearchSort.Latest);
    });
    expect(result.current.filters.sort).toBe(SearchSort.Latest);
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('resolves a publish-date preset to an ISO dateFrom window', () => {
    const { result } = renderHook(() => useSearchQueryParams(), {
      wrapper: wrapperFor('/search?q=barish&type=pieces'),
    });
    act(() => {
      result.current.setDate('week');
    });
    expect(result.current.filters.dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('clears all refining filters', () => {
    const { result } = renderHook(() => useSearchQueryParams(), {
      wrapper: wrapperFor('/search?q=barish&type=pieces&lang=ur&read=short&sort=latest'),
    });
    expect(result.current.hasActiveFilters).toBe(true);
    act(() => {
      result.current.clearFilters();
    });
    expect(result.current.hasActiveFilters).toBe(false);
  });
});
