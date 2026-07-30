import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useDebounce } from '@/hooks/use-debounce';

import { SEARCH_DEBOUNCE_MS } from './use-autocomplete';

/**
 * Binds the `/search` page's text field to the URL `q` param with a 300ms debounce (docs/06
 * §3.6). Typing updates local state instantly (responsive field) and writes to the URL on the
 * debounce with `replace` (a refinement, not a history entry) so results only re-query when the
 * user pauses. External navigations that change `q` (a recent chip, the command dropdown) flow
 * back into the field — but our OWN debounced writes are ignored via a guard ref, so the input
 * never reverts to a stale value mid-keystroke.
 *
 * Only `q` is touched here; every other search param is resolved by `useSearchQueryParams`.
 */
export function useSearchInput(): {
  text: string;
  setText: (value: string) => void;
  /** Flush the current text to the URL immediately (Enter / explicit submit). */
  commit: () => void;
} {
  const [params, setParams] = useSearchParams();
  const urlQuery = params.get('q') ?? '';

  const [text, setText] = useState(urlQuery);
  const debounced = useDebounce(text, SEARCH_DEBOUNCE_MS);
  // The last value we ourselves wrote to (or read from) the URL — distinguishes our writes from
  // external navigations so the two sync effects don't fight.
  const syncedRef = useRef(urlQuery);

  const writeToUrl = (value: string): void => {
    syncedRef.current = value;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set('q', value);
        else next.delete('q');
        return next;
      },
      { replace: true },
    );
  };

  // Debounced text → URL.
  useEffect(() => {
    if (debounced !== syncedRef.current) writeToUrl(debounced);
    // `setParams` from React Router is stable; `writeToUrl` closes over it only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // External URL change → field (ignore our own debounced writes).
  useEffect(() => {
    if (urlQuery !== syncedRef.current) {
      syncedRef.current = urlQuery;
      setText(urlQuery);
    }
  }, [urlQuery]);

  return {
    text,
    setText,
    commit: () => {
      writeToUrl(text.trim());
    },
  };
}
