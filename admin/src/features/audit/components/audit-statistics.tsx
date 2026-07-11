import type { ReactElement } from 'react';

import { EmptyState } from '@/components/empty-state';
import { LoadingState } from '@/components/loading-state';
import { StatCard } from '@/components/stat-card';
import { getErrorMessage } from '@/lib/errors';
import { formatCount } from '@/lib/format';

import { useAuditStatistics } from '../hooks/use-audit';

/** Audit statistics — actions today/week/month + top actions and most active actors. */
export function AuditStatistics(): ReactElement {
  const query = useAuditStatistics();

  if (query.isLoading) {
    return <LoadingState variant="rows" rows={3} />;
  }
  if (query.isError) {
    return <p className="text-sm text-danger">{getErrorMessage(query.error)}</p>;
  }
  const stats = query.data;
  if (stats === undefined) {
    return <EmptyState title="No statistics" />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Actions today" value={formatCount(stats.today)} />
        <StatCard label="Last 7 days" value={formatCount(stats.thisWeek)} />
        <StatCard label="Last 30 days" value={formatCount(stats.thisMonth)} />
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-ink">Top actions (30 days)</h3>
          {stats.topActions.length === 0 ? (
            <p className="text-sm text-ink-muted">No actions recorded.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {stats.topActions.map((row) => (
                <li key={row.action} className="flex justify-between text-sm">
                  <span className="font-mono text-ink">{row.action}</span>
                  <span className="tabular-nums text-ink-secondary">{formatCount(row.count)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-ink">Most active actors (30 days)</h3>
          {stats.mostActiveActors.length === 0 ? (
            <p className="text-sm text-ink-muted">No activity recorded.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {stats.mostActiveActors.map((row) => (
                <li key={row.actorId} className="flex justify-between text-sm">
                  <span className="tabular-nums text-ink">{row.actorId.slice(0, 8)}</span>
                  <span className="tabular-nums text-ink-secondary">{formatCount(row.count)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
