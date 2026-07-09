import type { ReactElement } from 'react';

import { PieceCardSkeleton } from './piece-card-skeleton';

/**
 * First-load skeleton feed (docs/06 §4.3) — a handful of layout-matched card skeletons.
 * `role="status"` + `aria-busy` announces the loading state politely to screen readers.
 */
export function FeedSkeleton({ count = 5 }: { count?: number }): ReactElement {
  return (
    <div role="status" aria-busy="true" aria-label="Loading feed" className="flex flex-col gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <PieceCardSkeleton key={i} />
      ))}
    </div>
  );
}
