import { QSkeleton } from '@qalam/ui';
import type { ReactElement } from 'react';

import { DashboardGrid } from '@/components/dashboard-grid';

/**
 * Full-dashboard loading placeholder — a stat-card row + two widget blocks. Used for the initial
 * page load before any widget query resolves; individual widgets show their own skeletons on refetch.
 */
export function DashboardSkeleton(): ReactElement {
  return (
    <div role="status" aria-label="Loading dashboard" className="flex flex-col gap-6">
      <DashboardGrid>
        {Array.from({ length: 4 }, (_, index) => (
          <QSkeleton key={index} variant="rect" height={92} radius="md" className="w-full" />
        ))}
      </DashboardGrid>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <QSkeleton variant="rect" height={240} radius="md" className="w-full" />
        <QSkeleton variant="rect" height={240} radius="md" className="w-full" />
      </div>
    </div>
  );
}
