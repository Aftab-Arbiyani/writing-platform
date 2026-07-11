import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useDebouncedSearch } from './use-debounced-search';

describe('useDebouncedSearch', () => {
  afterEach(() => vi.useRealTimers());

  it('updates the local value immediately but commits after the delay', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { result } = renderHook(() => useDebouncedSearch('', onChange, 300));

    act(() => result.current.commit('meera'));
    expect(result.current.value).toBe('meera'); // snappy input
    expect(onChange).not.toHaveBeenCalled(); // debounced

    act(() => vi.advanceTimersByTime(300));
    expect(onChange).toHaveBeenCalledWith('meera');
  });

  it('debounces rapid input to a single commit', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { result } = renderHook(() => useDebouncedSearch('', onChange, 300));

    act(() => result.current.commit('m'));
    act(() => result.current.commit('me'));
    act(() => result.current.commit('mee'));
    act(() => vi.advanceTimersByTime(300));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('mee');
  });

  it('syncs the value down when the external search changes', () => {
    const { result, rerender } = renderHook(({ s }) => useDebouncedSearch(s, vi.fn()), {
      initialProps: { s: 'a' },
    });
    expect(result.current.value).toBe('a');
    rerender({ s: 'b' });
    expect(result.current.value).toBe('b');
  });
});
