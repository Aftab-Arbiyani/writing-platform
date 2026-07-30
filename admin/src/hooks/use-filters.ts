import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

/**
 * URL-synced table filters (docs/24 — tabs/filters live in the URL, not component state). Given a
 * fixed set of filter keys, reads their current values from the query string and writes changes
 * back. Setting/clearing any filter resets pagination to page 1 (a filtered result set is a new
 * page 1). Empty values are removed from the URL for clean, shareable links.
 */
export interface Filters<K extends string> {
  values: Record<K, string | undefined>;
  setFilter: (key: K, value: string | undefined) => void;
  reset: () => void;
  activeCount: number;
}

export function useFilters<K extends string>(keys: readonly K[]): Filters<K> {
  const [params, setParams] = useSearchParams();

  const values = useMemo<Record<K, string | undefined>>(() => {
    const out = {} as Record<K, string | undefined>;
    for (const key of keys) out[key] = params.get(key) ?? undefined;
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `keys` is a stable literal per call site
  }, [params, keys.join('|')]);

  const setFilter = useCallback(
    (key: K, value: string | undefined) => {
      setParams(
        (prev) => {
          const sp = new URLSearchParams(prev);
          if (value === undefined || value === '') sp.delete(key);
          else sp.set(key, value);
          sp.delete('page'); // filtering returns to the first page
          return sp;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const reset = useCallback(() => {
    setParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        for (const key of keys) sp.delete(key);
        sp.delete('page');
        return sp;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `keys` is a stable literal per call site
  }, [setParams, keys.join('|')]);

  const activeCount = keys.reduce((count, key) => (values[key] ? count + 1 : count), 0);

  return { values, setFilter, reset, activeCount };
}
