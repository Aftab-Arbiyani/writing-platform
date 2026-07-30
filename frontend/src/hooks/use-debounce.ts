import { useEffect, useState } from 'react';

/** Returns `value` after it has stopped changing for `delayMs` (search inputs, etc.). */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => {
      clearTimeout(id);
    };
  }, [value, delayMs]);

  return debounced;
}
