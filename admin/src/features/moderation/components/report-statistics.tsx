import type { ReactElement } from 'react';

import { EmptyState } from '@/components/empty-state';
import { LoadingState } from '@/components/loading-state';
import { StatCard } from '@/components/stat-card';
import { getErrorMessage } from '@/lib/errors';
import { formatCount } from '@/lib/format';

import { useReportStatistics, useReportTrends } from '../hooks/use-reports';

/** Formats a mean-seconds duration as e.g. "2h 30m" / "45m" / "—". */
function formatDuration(seconds: number | null): string {
  if (seconds === null) {
    return '—';
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function Breakdown({ title, data }: { title: string; data: Record<string, number> }): ReactElement {
  const rows = Object.entries(data);
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">No data.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map(([key, count]) => (
            <li key={key} className="flex justify-between text-sm capitalize">
              <span className="text-ink">{key}</span>
              <span className="tabular-nums text-ink-secondary">{formatCount(count)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Report statistics + trends (A6). */
export function ReportStatistics(): ReactElement {
  const stats = useReportStatistics();
  const trends = useReportTrends({});

  if (stats.isLoading) {
    return <LoadingState variant="rows" rows={4} />;
  }
  if (stats.isError) {
    return <p className="text-sm text-danger">{getErrorMessage(stats.error)}</p>;
  }
  const data = stats.data;
  if (data === undefined) {
    return <EmptyState title="No statistics" />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Open reports" value={formatCount(data.openReports)} />
        <StatCard label="Resolved" value={formatCount(data.resolvedReports)} />
        <StatCard label="Dismissed" value={formatCount(data.dismissedReports)} />
        <StatCard label="Avg resolution" value={formatDuration(data.avgResolutionSeconds)} />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Breakdown title="By status" data={data.byStatus} />
        <Breakdown title="By severity" data={data.bySeverity} />
        <Breakdown title="By reason" data={data.byCategory} />
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-ink">Moderator activity</h3>
        {data.moderatorPerformance.length === 0 ? (
          <p className="text-sm text-ink-muted">No resolutions yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {data.moderatorPerformance.map((row) => (
              <li key={row.moderatorId} className="flex justify-between text-sm">
                <span className="tabular-nums text-ink">{row.moderatorId.slice(0, 8)}</span>
                <span className="tabular-nums text-ink-secondary">
                  {formatCount(row.resolved)} resolved · {formatDuration(row.avgSeconds)} avg
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-ink">Trends (30 days)</h3>
        {trends.data === undefined || trends.data.points.length === 0 ? (
          <p className="text-sm text-ink-muted">No trend data.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {trends.data.points.map((point) => (
              <li key={point.date} className="flex justify-between text-sm">
                <span className="tabular-nums text-ink">{point.date}</span>
                <span className="tabular-nums text-ink-secondary">
                  +{formatCount(point.created)} · −{formatCount(point.resolved)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
