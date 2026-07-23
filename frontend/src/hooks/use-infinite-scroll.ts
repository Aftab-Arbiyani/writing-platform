import { useCallback, useRef } from 'react';

/**
 * Infinite-scroll sentinel (docs/06 §4.2) — the one implementation reused by every timeline
 * (§10.3 rule 4). Attach the returned **callback ref** to an element at the end of the list;
 * when it comes within `rootMargin` of the viewport (default **800px** below, so the next page
 * prefetches before the reader reaches the bottom) and there is more to load, `onLoadMore` fires.
 *
 * A callback ref (not a ref object + effect) is deliberate: lists render a loading skeleton first
 * and only mount the sentinel once data arrives, so an effect keyed on mount would observe a
 * still-absent node and never re-attach. React invokes the callback ref exactly when the sentinel
 * mounts (and again with `null` on unmount), so the observer always binds to the real node.
 *
 * Latest flags/callback are read from a ref so the observer is created once per sentinel node (not
 * re-created on every render). Degrades to a no-op where `IntersectionObserver` is absent
 * (SSR/jsdom) — the list still renders fully; tests drive fetchNextPage directly.
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
}: UseInfiniteScrollOptions): (node: T | null) => void {
  const stateRef = useRef({ hasMore, isLoading, onLoadMore });
  stateRef.current = { hasMore, isLoading, onLoadMore };
  const observerRef = useRef<IntersectionObserver | null>(null);

  return useCallback(
    (node: T | null) => {
      // Tear down any observer bound to a previous sentinel node before (re)binding.
      observerRef.current?.disconnect();
      observerRef.current = null;
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
      observerRef.current = observer;
    },
    [rootMargin],
  );
}
