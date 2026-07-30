import { QCard, QSkeleton } from '@qalam/ui';
import type { ReactElement } from 'react';

/**
 * Skeleton-first loading (docs/06 §4.1) for result lists. A row-shaped placeholder that echoes
 * the result card so the layout doesn't jump when data arrives. Pulses auto-disable under
 * reduced motion (`QSkeleton`).
 */
export function ResultRowSkeleton(): ReactElement {
  return (
    <QCard padding="md" className="flex gap-3">
      <QSkeleton variant="avatar" avatarSize={48} />
      <div className="flex flex-1 flex-col gap-2 py-1">
        <QSkeleton variant="title" width="55%" />
        <QSkeleton variant="text" lines={2} />
      </div>
    </QCard>
  );
}

export function ResultListSkeleton({ count = 5 }: { count?: number }): ReactElement {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <ResultRowSkeleton key={i} />
      ))}
    </div>
  );
}

/** Compact chip-row skeleton for the taxonomy tabs (tags / genres / languages). */
export function TaxonomyListSkeleton({ count = 6 }: { count?: number }): ReactElement {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <QCard key={i} padding="md" className="flex items-center justify-between">
          <QSkeleton variant="title" width={140} />
          <QSkeleton variant="text" lines={1} width={60} />
        </QCard>
      ))}
    </div>
  );
}
