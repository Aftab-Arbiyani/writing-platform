import { QSkeleton } from '@qalam/ui';
import type { ReactElement } from 'react';

/** Section-shaped loading placeholder for a settings form (A7). */
export function SettingsSkeleton({ rows = 5 }: { rows?: number }): ReactElement {
  return (
    <div
      className="rounded-lg border border-line bg-surface p-4"
      role="status"
      aria-label="Loading settings"
    >
      <QSkeleton variant="text" width="40%" className="mb-4" />
      <div className="flex flex-col gap-5">
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] sm:gap-6"
          >
            <div className="flex flex-col gap-2">
              <QSkeleton variant="text" width="60%" />
              <QSkeleton variant="text" width="90%" />
            </div>
            <QSkeleton variant="rect" height={36} radius="sm" className="w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
