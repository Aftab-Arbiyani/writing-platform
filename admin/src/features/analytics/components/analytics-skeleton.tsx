import { QSkeleton } from '@qalam/ui';
import type { ReactElement } from 'react';

import { DashboardGrid } from '@/components/dashboard-grid';

/** Metric-grid + chart skeleton shown while a section first loads (A8). */
export function AnalyticsSkeleton({
  metrics = 8,
  charts = 2,
}: {
  metrics?: number;
  charts?: number;
}): ReactElement {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Loading analytics">
      <DashboardGrid>
        {Array.from({ length: metrics }, (_, index) => (
          <QSkeleton key={index} variant="rect" height={92} radius="md" className="w-full" />
        ))}
      </DashboardGrid>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: charts }, (_, index) => (
          <QSkeleton key={index} variant="rect" height={320} radius="md" className="w-full" />
        ))}
      </div>
    </div>
  );
}
