import { QCard } from '@qalam/ui';
import { Table, type TableColumnsType } from 'antd';
import {
  BrainCircuit,
  CreditCard,
  Database,
  HardDrive,
  ListChecks,
  Search,
  Server,
  SlidersHorizontal,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { ReactElement } from 'react';

import { DashboardGrid } from '@/components/dashboard-grid';
import { HealthStatusCard } from '@/components/health-status-card';
import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { StatusIndicator } from '@/components/status-indicator';
import { useQueues } from '@/features/dashboard/hooks/use-queues';
import type { QueueStatus } from '@/features/dashboard/types/dashboard.types';
import { usePageTitle } from '@/hooks/use-page-title';
import { formatCount } from '@/lib/format';

import { AsyncSection } from '@/components/async-section';
import { BoolIndicator } from '../components/bool-indicator';
import { useCache, useDeepHealth } from '../hooks/use-system';
import type { WarmableCache } from '../types/system.types';

/** Per-dependency icon + display label for the deep-health grid. */
const DEPENDENCY_META: Record<string, { label: string; icon: LucideIcon }> = {
  database: { label: 'Database', icon: Database },
  redis: { label: 'Redis', icon: Zap },
  queues: { label: 'Queues', icon: ListChecks },
  storage: { label: 'Storage', icon: HardDrive },
  config: { label: 'Config', icon: SlidersHorizontal },
  search: { label: 'Search', icon: Search },
  ai: { label: 'AI', icon: BrainCircuit },
  payments: { label: 'Payments', icon: CreditCard },
};

const QUEUE_COLUMNS: TableColumnsType<QueueStatus> = [
  { title: 'Queue', dataIndex: 'name', key: 'name' },
  {
    title: 'Workers',
    key: 'workers',
    align: 'right',
    className: 'tabular-nums',
    render: (_, queue) => formatCount(queue.workers),
  },
  {
    title: 'Paused',
    key: 'paused',
    render: (_, queue) => (
      <BoolIndicator
        value={queue.paused}
        trueLabel="Paused"
        falseLabel="Running"
        trueStatus="warning"
      />
    ),
  },
  {
    title: 'Waiting',
    key: 'waiting',
    align: 'right',
    className: 'tabular-nums',
    render: (_, queue) => formatCount(queue.counts.waiting),
  },
  {
    title: 'Active',
    key: 'active',
    align: 'right',
    className: 'tabular-nums',
    render: (_, queue) => formatCount(queue.counts.active),
  },
  {
    title: 'Completed',
    key: 'completed',
    align: 'right',
    className: 'tabular-nums',
    render: (_, queue) => formatCount(queue.counts.completed),
  },
  {
    title: 'Failed',
    key: 'failed',
    align: 'right',
    className: 'tabular-nums',
    render: (_, queue) => (
      <span className={queue.counts.failed > 0 ? 'text-danger' : undefined}>
        {formatCount(queue.counts.failed)}
      </span>
    ),
  },
  {
    title: 'Delayed',
    key: 'delayed',
    align: 'right',
    className: 'tabular-nums',
    render: (_, queue) => formatCount(queue.counts.delayed),
  },
];

const WARMABLE_COLUMNS: TableColumnsType<WarmableCache> = [
  { title: 'Group', dataIndex: 'label', key: 'label' },
  { title: 'Key', dataIndex: 'key', key: 'key' },
  {
    title: 'Prefix',
    dataIndex: 'prefix',
    key: 'prefix',
    render: (prefix: string) => <span className="font-mono text-sm text-ink">{prefix}</span>,
  },
];

interface PrefixRow {
  prefix: string;
  count: number;
}

/**
 * Infrastructure Health (P7.1) — the deep per-dependency snapshot (`/health/deep`), the BullMQ
 * queue-depth table (`/admin/queues`, shared with the dashboard), and the cache DB snapshot
 * (`/admin/cache`). Each section owns its query + state so one failing read never blanks the page.
 * Auto-refreshing; read-only, admin-gated.
 */
export function InfrastructureHealthPage(): ReactElement {
  usePageTitle('Infrastructure health');
  const deep = useDeepHealth();
  const queues = useQueues();
  const cache = useCache();

  const cachePrefixRows: PrefixRow[] = cache.data
    ? Object.entries(cache.data.byPrefix)
        .map(([prefix, count]) => ({ prefix, count }))
        .sort((a, b) => b.count - a.count)
    : [];

  return (
    <PageContainer>
      <PageHeader
        title="Infrastructure health"
        description="Live dependency, queue, and cache status across the platform."
        actions={
          deep.data ? (
            <StatusIndicator
              status={deep.data.overall}
              label={deep.data.overall === 'healthy' ? 'All systems healthy' : undefined}
            />
          ) : null
        }
      />

      {/* Dependencies — the deep-health snapshot. */}
      <QCard as="section" padding="lg" className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-ink">Dependencies</h2>
        <AsyncSection
          isLoading={deep.isLoading}
          error={deep.error}
          onRetry={() => void deep.refetch()}
          loadingRows={4}
        >
          {deep.data ? (
            <DashboardGrid minColWidth={180}>
              {deep.data.dependencies.map((dependency) => {
                const meta = DEPENDENCY_META[dependency.key] ?? {
                  label: dependency.key,
                  icon: Server,
                };
                return (
                  <HealthStatusCard
                    key={dependency.key}
                    name={meta.label}
                    status={dependency.status}
                    icon={meta.icon}
                  />
                );
              })}
            </DashboardGrid>
          ) : null}
        </AsyncSection>
      </QCard>

      {/* Queues — depth + worker table (shared with the dashboard). */}
      <QCard as="section" padding="lg" className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-ink">Queues</h2>
        <Table<QueueStatus>
          columns={QUEUE_COLUMNS}
          dataSource={queues.data ?? []}
          rowKey="name"
          loading={queues.isLoading}
          pagination={false}
          size="middle"
          sticky
          scroll={{ x: 'max-content' }}
        />
      </QCard>

      {/* Cache — DB snapshot. */}
      <QCard as="section" padding="lg" className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-ink">Cache</h2>
        <AsyncSection
          isLoading={cache.isLoading}
          error={cache.error}
          onRetry={() => void cache.refetch()}
          loadingRows={4}
        >
          {cache.data ? (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard label="Total keys" value={formatCount(cache.data.keys)} icon={Database} />
                <StatCard label="Used memory" value={cache.data.usedMemory ?? '—'} icon={Zap} />
                <StatCard
                  label="Warmable groups"
                  value={formatCount(cache.data.warmable.length)}
                  icon={ListChecks}
                />
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-medium text-ink-secondary">Keys by prefix</h3>
                  <Table<PrefixRow>
                    columns={[
                      {
                        title: 'Prefix',
                        dataIndex: 'prefix',
                        key: 'prefix',
                        render: (prefix: string) => (
                          <span className="font-mono text-sm text-ink">{prefix}</span>
                        ),
                      },
                      {
                        title: 'Keys',
                        dataIndex: 'count',
                        key: 'count',
                        align: 'right',
                        className: 'tabular-nums',
                        render: (count: number) => formatCount(count),
                      },
                    ]}
                    dataSource={cachePrefixRows}
                    rowKey="prefix"
                    pagination={false}
                    size="small"
                    scroll={{ x: 'max-content' }}
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-medium text-ink-secondary">Warmable groups</h3>
                  <Table<WarmableCache>
                    columns={WARMABLE_COLUMNS}
                    dataSource={cache.data.warmable}
                    rowKey="key"
                    pagination={false}
                    size="small"
                    scroll={{ x: 'max-content' }}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </AsyncSection>
      </QCard>
    </PageContainer>
  );
}
