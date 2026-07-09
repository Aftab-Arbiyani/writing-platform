import { useCallback, useState } from 'react';

type Updater<T> = T | ((previous: T) => T);

/**
 * State persisted to localStorage (JSON). NOTE: auth tokens are never stored here
 * (in-memory only — docs/12 §7); the theme store owns its own persistence. Use for
 * benign device preferences (e.g. reading size, dismissed hints).
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: Updater<T>) => void] {
  const [stored, setStored] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: Updater<T>) => {
      setStored((previous) => {
        const next = typeof value === 'function' ? (value as (p: T) => T)(previous) : value;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* storage unavailable/full — keep in-memory value */
        }
        return next;
      });
    },
    [key],
  );

  return [stored, setValue];
}
