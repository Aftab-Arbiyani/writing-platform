import { QSkeleton } from '@qalam/ui';
import type { ReactElement } from 'react';

/** Skeleton-first loading (docs/06 §4.1) — a row echoing the notification layout. */
export function NotificationRowSkeleton(): ReactElement {
  return (
    <div className="flex gap-3 px-3 py-3">
      <QSkeleton variant="avatar" avatarSize={32} />
      <div className="flex flex-1 flex-col gap-2 py-1">
        <QSkeleton variant="text" lines={2} />
        <QSkeleton variant="rect" width={64} height={12} radius="sm" />
      </div>
    </div>
  );
}

export function NotificationListSkeleton({ count = 6 }: { count?: number }): ReactElement {
  return (
    <div aria-hidden className="flex flex-col">
      {Array.from({ length: count }).map((_, i) => (
        <NotificationRowSkeleton key={i} />
      ))}
    </div>
  );
}
