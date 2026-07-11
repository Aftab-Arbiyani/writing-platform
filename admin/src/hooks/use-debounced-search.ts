import { useEffect, useRef, useState } from 'react';

/**
 * Local, debounced search box state (A9 — consolidates the identical pattern
 * previously copied in the users / audit / reports toolbars). Keeps a snappy
 * local `value` for the input while committing the debounced term to the caller
 * (which typically pushes it to the URL/query). Syncs down when the external
 * `search` changes (e.g. a filter reset) and clears its timer on unmount.
 */
export function useDebouncedSearch(
  search: string,
  onChange: (value: string) => void,
  delayMs = 350,
): { value: string; commit: (next: string) => void } {
  const [value, setValue] = useState(search);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => setValue(search), [search]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const commit = (next: string): void => {
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(next), delayMs);
  };

  return { value, commit };
}
