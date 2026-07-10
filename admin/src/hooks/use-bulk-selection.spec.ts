import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useBulkSelection } from '@/hooks/use-bulk-selection';

describe('useBulkSelection', () => {
  it('toggles, selects all, reports state, and clears', () => {
    const { result } = renderHook(() => useBulkSelection());

    act(() => result.current.toggle('a'));
    expect(result.current.isSelected('a')).toBe(true);
    expect(result.current.selectedCount).toBe(1);

    act(() => result.current.toggle('a'));
    expect(result.current.isSelected('a')).toBe(false);

    act(() => result.current.selectAll(['a', 'b', 'c']));
    expect(result.current.selectedCount).toBe(3);
    expect(result.current.allSelected(['a', 'b', 'c'])).toBe(true);
    expect(result.current.selectedIds).toEqual(['a', 'b', 'c']);

    act(() => result.current.clear());
    expect(result.current.selectedCount).toBe(0);
    expect(result.current.allSelected(['a'])).toBe(false);
  });
});
