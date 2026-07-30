import { QCard, QSkeleton } from '@qalam/ui';
import type { ReactElement } from 'react';

/**
 * Layout-matched skeleton for a `PieceCard` (docs/06 §4.3 — dimensions match the real card so
 * there is no skeleton-then-jump). Shimmer goes static under reduced motion (QSkeleton).
 */
export function PieceCardSkeleton(): ReactElement {
  return (
    <QCard as="article" padding="lg" className="flex flex-col gap-3" aria-hidden>
      <div className="flex items-center gap-2">
        <QSkeleton variant="avatar" avatarSize={32} />
        <QSkeleton variant="text" lines={1} width="40%" />
      </div>
      <QSkeleton variant="title" width="80%" />
      <QSkeleton variant="text" lines={2} />
      <div className="mt-1 flex gap-3">
        <QSkeleton variant="text" lines={1} width={64} />
        <QSkeleton variant="text" lines={1} width={48} />
        <QSkeleton variant="text" lines={1} width={48} />
      </div>
    </QCard>
  );
}
