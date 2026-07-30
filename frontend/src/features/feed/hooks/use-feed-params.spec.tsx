import { act, renderHook } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '@/stores/auth.store';

import { useFeedParams } from './use-feed-params';

function wrapperFor(initialEntry: string) {
  return function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>;
  };
}

describe('useFeedParams', () => {
  beforeEach(() => {
    useAuthStore.getState().clear();
  });

  it('defaults to discover for visitors and following for signed-in readers', () => {
    const visitor = renderHook(() => useFeedParams(), { wrapper: wrapperFor('/feed') });
    expect(visitor.result.current.tab).toBe('discover');

    useAuthStore.setState({ status: 'authenticated' });
    const reader = renderHook(() => useFeedParams(), { wrapper: wrapperFor('/feed') });
    expect(reader.result.current.tab).toBe('following');
  });

  it('reads tab + filters from the URL and resolves them', () => {
    const { result } = renderHook(() => useFeedParams(), {
      wrapper: wrapperFor('/feed?tab=latest&lang=ur&genre=ghazal&read=short&sort=most_clapped'),
    });
    expect(result.current.tab).toBe('latest');
    expect(result.current.language).toBe('ur');
    expect(result.current.genre).toBe('ghazal');
    expect(result.current.readingTime).toBe('short');
    expect(result.current.sort).toBe('most_clapped');
    expect(result.current.filters).toMatchObject({
      language: 'ur',
      genre: 'ghazal',
      sort: 'most_clapped',
      maxReadingTime: 300,
    });
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('omits sort from the resolved filters on the trending tab', () => {
    const { result } = renderHook(() => useFeedParams(), {
      wrapper: wrapperFor('/feed?tab=trending&sort=most_clapped'),
    });
    expect(result.current.filters.sort).toBeUndefined();
  });

  it('falls back to the default tab for an unknown ?tab value', () => {
    const { result } = renderHook(() => useFeedParams(), {
      wrapper: wrapperFor('/feed?tab=bogus'),
    });
    expect(result.current.tab).toBe('discover');
  });

  it('setLanguage writes the URL param and updates the resolved filters', () => {
    const { result } = renderHook(() => useFeedParams(), {
      wrapper: wrapperFor('/feed?tab=latest'),
    });
    act(() => {
      result.current.setLanguage('hi');
    });
    expect(result.current.language).toBe('hi');
    expect(result.current.filters.language).toBe('hi');
  });

  it('clearFilters removes every filter param', () => {
    const { result } = renderHook(() => useFeedParams(), {
      wrapper: wrapperFor('/feed?tab=latest&lang=ur&genre=ghazal&read=short'),
    });
    act(() => {
      result.current.clearFilters();
    });
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.language).toBeNull();
    expect(result.current.genre).toBeNull();
    expect(result.current.readingTime).toBeNull();
  });
});
