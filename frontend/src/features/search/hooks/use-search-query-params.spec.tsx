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
