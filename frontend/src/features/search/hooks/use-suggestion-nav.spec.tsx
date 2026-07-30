import { act, renderHook } from '@testing-library/react';
import type { KeyboardEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useSuggestionNav } from './use-suggestion-nav';

/** A minimal fake React keyboard event carrying just what the hook reads. */
function key(k: string): KeyboardEvent {
  return { key: k, preventDefault: vi.fn() } as unknown as KeyboardEvent;
}

function setup(count = 3) {
  const onSelect = vi.fn();
  const onSubmit = vi.fn();
  const onEscape = vi.fn();
  const view = renderHook(({ c }) => useSuggestionNav({ count: c, onSelect, onSubmit, onEscape }), {
    initialProps: { c: count },
  });
  return { ...view, onSelect, onSubmit, onEscape };
}

describe('useSuggestionNav', () => {
  it('starts with no active option', () => {
    const { result } = setup();
    expect(result.current.activeIndex).toBe(-1);
  });

  it('moves the highlight down and clamps at the last option', () => {
    const { result } = setup(3);
    act(() => {
      result.current.handleKeyDown(key('ArrowDown'));
    });
    expect(result.current.activeIndex).toBe(0);
    act(() => {
      result.current.handleKeyDown(key('ArrowDown'));
      result.current.handleKeyDown(key('ArrowDown'));
      result.current.handleKeyDown(key('ArrowDown'));
    });
    expect(result.current.activeIndex).toBe(2); // clamped at count-1
  });

  it('moves the highlight up, back to the input row (-1)', () => {
    const { result } = setup(3);
    act(() => {
      result.current.handleKeyDown(key('ArrowDown'));
      result.current.handleKeyDown(key('ArrowUp'));
      result.current.handleKeyDown(key('ArrowUp'));
    });
    expect(result.current.activeIndex).toBe(-1);
  });

  it('Enter selects the highlighted option', () => {
    const { result, onSelect, onSubmit } = setup(3);
    act(() => {
      result.current.handleKeyDown(key('ArrowDown'));
    });
    act(() => {
      result.current.handleKeyDown(key('Enter'));
    });
    expect(onSelect).toHaveBeenCalledWith(0);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('Enter submits the typed query when nothing is highlighted', () => {
    const { result, onSelect, onSubmit } = setup(3);
    act(() => {
      result.current.handleKeyDown(key('Enter'));
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('Escape invokes the close handler', () => {
    const { result, onEscape } = setup();
    act(() => {
      result.current.handleKeyDown(key('Escape'));
    });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('clamps the active index when the option list shrinks', () => {
    const { result, rerender } = setup(3);
    act(() => {
      result.current.handleKeyDown(key('ArrowDown'));
      result.current.handleKeyDown(key('ArrowDown'));
      result.current.handleKeyDown(key('ArrowDown'));
    });
    expect(result.current.activeIndex).toBe(2);
    rerender({ c: 1 });
    expect(result.current.activeIndex).toBe(0);
  });
});
