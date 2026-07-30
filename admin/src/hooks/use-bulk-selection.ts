import { useCallback, useMemo, useState } from 'react';

/**
 * Row selection state for bulk actions in admin tables. Local component state (a transient UI
 * concern, not server or URL state). Tracks a Set of ids; exposes toggle / select-all / clear and
 * derived helpers the `BulkActionBar` + `DataTable` consume.
 */
export interface BulkSelection<T extends string = string> {
  selectedIds: T[];
  selectedCount: number;
  isSelected: (id: T) => boolean;
  toggle: (id: T) => void;
  selectAll: (ids: readonly T[]) => void;
  clear: () => void;
  /** True when every id in `ids` is currently selected (drives the header checkbox). */
  allSelected: (ids: readonly T[]) => boolean;
}

export function useBulkSelection<T extends string = string>(): BulkSelection<T> {
  const [selected, setSelected] = useState<ReadonlySet<T>>(() => new Set<T>());

  const toggle = useCallback((id: T) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: readonly T[]) => {
    setSelected(new Set(ids));
  }, []);

  const clear = useCallback(() => {
    setSelected(new Set<T>());
  }, []);

  const isSelected = useCallback((id: T) => selected.has(id), [selected]);

  const allSelected = useCallback(
    (ids: readonly T[]) => ids.length > 0 && ids.every((id) => selected.has(id)),
    [selected],
  );

  const selectedIds = useMemo(() => [...selected], [selected]);

  return {
    selectedIds,
    selectedCount: selected.size,
    isSelected,
    toggle,
    selectAll,
    clear,
    allSelected,
  };
}
