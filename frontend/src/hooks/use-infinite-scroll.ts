import { useEffect, useRef } from 'react';

/**
 * Infinite-scroll sentinel (docs/06 §4.2) — the one implementation reused by every timeline
 * (§10.3 rule 4). Attach the returned ref to an element at the end of the list; when it comes
 * within `rootMargin` of the viewport (default **800px** below, so the next page prefetches
 * before the reader reaches the bottom) and there is more to load, `onLoadMore` fires.
 *
 * Latest flags/callback are read from a ref so the observer is created once (not re-created on
 * every render). Degrades to a no-op where `IntersectionObserver` is absent (SSR/jsdom) — the
 * UI still offers no dead-ends because the list renders fully; tests drive fetchNextPage directly.
 */
interface UseInfiniteScrollOptions {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  /** CSS margin box grown around the root; default grows the bottom by 800px. */
  rootMargin?: string;
}

export function useInfiniteScroll<T extends HTMLElement = HTMLDivElement>({
  hasMore,
  isLoading,
  onLoadMore,
  rootMargin = '0px 0px 800px 0px',
}: UseInfiniteScrollOptions) {
  const sentinelRef = useRef<T | null>(null);
  const stateRef = useRef({ hasMore, isLoading, onLoadMore });
  stateRef.current = { hasMore, isLoading, onLoadMore };

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const state = stateRef.current;
        if (entry?.isIntersecting && state.hasMore && !state.isLoading) {
          state.onLoadMore();
        }
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [rootMargin]);

  return sentinelRef;
}
