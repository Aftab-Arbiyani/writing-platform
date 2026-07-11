import type { ReactElement } from 'react';

import { DashboardGrid } from '@/components/dashboard-grid';
import { StatCard } from '@/components/stat-card';
import { StatusIndicator } from '@/components/status-indicator';
import { formatCount } from '@/lib/format';

import { BarChart } from '../charts/bar-chart';
import { ChartContainer } from '../charts/chart-container';
import { formatBytes, formatRate } from '../analytics.constants';
import { AnalyticsCard } from '../components/analytics-card';
import { SectionState } from '../components/section-state';
import { useSystemAnalytics } from '../hooks/use-analytics';

/** System Analytics — API/Redis health, queues/workers, cache, DB size. */
export function SystemSection(): ReactElement {
  const query = useSystemAnalytics();
  const data = query.data;
  const redisUp = data?.cacheHitRatio !== null && data?.cacheHitRatio !== undefined;

  return (
    <SectionState
      loading={query.isLoading}
      error={query.isError ? query.error : null}
      onRetry={() => void query.refetch()}
      metrics={6}
      charts={1}
    >
      {data !== undefined ? (
        <div className="flex flex-col gap-6">
          <DashboardGrid>
            <StatCard
              label="API health"
              value={<StatusIndicator status="healthy" label="Responding" />}
            />
            <StatCard
              label="Redis"
              value={
                <StatusIndicator
                  status={redisUp ? 'healthy' : 'critical'}
                  label={redisUp ? 'Connected' : 'Unavailable'}
                />
              }
            />
            <StatCard
              label="Cache hit rate"
              value={data.cacheHitRatio !== null ? formatRate(data.cacheHitRatio) : '—'}
              hint={data.cacheKeys !== null ? `${formatCount(data.cacheKeys)} keys` : undefined}
            />
            <StatCard
              label="Cache memory"
              value={data.cacheMemoryBytes !== null ? formatBytes(data.cacheMemoryBytes) : '—'}
            />
            <StatCard
              label="Workers"
              value={data.workersEnabled ? formatCount(data.activeWorkers) : 'Disabled'}
              hint={data.workersEnabled ? 'active jobs' : undefined}
            />
            <StatCard label="Database size" value={formatBytes(data.databaseSizeBytes)} />
            <StatCard label="API requests" value="—" hint="Per-node · see /metrics" />
            <StatCard label="Response time" value="—" hint="Per-node · see /metrics" />
          </DashboardGrid>

          <AnalyticsCard title="Queues">
            {data.queues.length === 0 ? (
              <p className="py-2 text-sm text-ink-muted">
                No worker backbone on this node (workers may run separately).
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-start text-xs uppercase tracking-wide text-ink-muted">
                      <th scope="col" className="py-1.5 text-start font-medium">
                        Queue
                      </th>
                      <th scope="col" className="py-1.5 text-end font-medium">
                        Waiting
                      </th>
                      <th scope="col" className="py-1.5 text-end font-medium">
                        Active
                      </th>
                      <th scope="col" className="py-1.5 text-end font-medium">
                        Completed
                      </th>
                      <th scope="col" className="py-1.5 text-end font-medium">
                        Failed
                      </th>
                      <th scope="col" className="py-1.5 text-end font-medium">
                        Delayed
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.queues.map((queue) => (
                      <tr key={queue.name} className="border-b border-line last:border-0">
                        <td className="py-1.5 font-mono text-ink">{queue.name}</td>
                        <td className="py-1.5 text-end tabular-nums text-ink-secondary">
                          {queue.waiting}
                        </td>
                        <td className="py-1.5 text-end tabular-nums text-ink-secondary">
                          {queue.active}
                        </td>
                        <td className="py-1.5 text-end tabular-nums text-ink-secondary">
                          {queue.completed}
                        </td>
                        <td className="py-1.5 text-end tabular-nums text-danger">{queue.failed}</td>
                        <td className="py-1.5 text-end tabular-nums text-ink-secondary">
                          {queue.delayed}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AnalyticsCard>

          <ChartContainer
            title="Largest tables"
            isEmpty={data.topTables.length === 0}
            table={{
              columns: ['Table', 'Size'],
              rows: data.topTables.map((t) => [t.table, formatBytes(t.bytes)]),
            }}
          >
            <BarChart
              ariaLabel="Largest database tables by size"
              horizontal
              categories={data.topTables.map((t) => t.table)}
              data={data.topTables.map((t) => t.bytes)}
            />
          </ChartContainer>

          <p className="text-xs text-ink-muted">{data.storageNote}</p>
        </div>
      ) : null}
    </SectionState>
  );
}
