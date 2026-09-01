import { QCard } from '@qalam/ui';
import { Table, type TableColumnsType } from 'antd';
import { CalendarRange, DollarSign } from 'lucide-react';
import type { ReactElement } from 'react';

import { EnvBadge } from '@/components/env-badge';
import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { usePageTitle } from '@/hooks/use-page-title';
import { formatUsd } from '@/lib/format';

import { AsyncSection } from '@/components/async-section';
import { CostTrendBadge } from '../components/operations-badges';
import { useCost } from '../hooks/use-operations';
import type { CostLine } from '../types/operations.types';

const COST_COLUMNS: TableColumnsType<CostLine> = [
  {
    title: 'Category',
    dataIndex: 'category',
    key: 'category',
    render: (category: string) => <span className="font-mono text-sm text-ink">{category}</span>,
  },
  {
    title: 'Line',
    dataIndex: 'label',
    key: 'label',
    render: (label: string) => <span className="font-medium text-ink">{label}</span>,
  },
  {
    title: 'Daily',
    dataIndex: 'dailyUsd',
    key: 'dailyUsd',
    align: 'right',
    className: 'tabular-nums',
    render: (dailyUsd: number) => formatUsd(dailyUsd),
  },
  {
    title: 'Monthly',
    dataIndex: 'monthlyUsd',
    key: 'monthlyUsd',
    align: 'right',
    className: 'tabular-nums',
    render: (monthlyUsd: number) => formatUsd(monthlyUsd),
  },
  { title: 'Basis', dataIndex: 'basis', key: 'basis' },
];

/**
 * Cost Dashboard (P7.4) — the estimated platform run-rate: daily + monthly totals with a trend
 * badge, and the per-line breakdown (category, daily / monthly, estimation basis). Read-only,
 * admin-gated.
 */
export function CostDashboardPage(): ReactElement {
  usePageTitle('Cost');
  const query = useCost();
  const cost = query.data;

  return (
    <PageContainer>
      <PageHeader
        title="Cost"
        description="Estimated platform run-rate and the per-line cost breakdown."
        actions={
          <div className="flex items-center gap-2">
            {cost ? <CostTrendBadge trend={cost.trend} /> : null}
            <EnvBadge />
          </div>
        }
      />

      <AsyncSection
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        loadingRows={6}
      >
        {cost ? (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <StatCard
                label="Daily total"
                value={formatUsd(cost.dailyUsd)}
                icon={DollarSign}
                hint="Estimated per-day spend"
              />
              <StatCard
                label="Monthly total"
                value={formatUsd(cost.monthlyUsd)}
                icon={CalendarRange}
                hint="Projected monthly spend"
              />
            </div>

            <QCard as="section" padding="lg" className="flex flex-col gap-4">
              <h2 className="text-base font-semibold text-ink">Cost breakdown</h2>
              <Table<CostLine>
                columns={COST_COLUMNS}
                dataSource={cost.lines}
                rowKey={(line) => `${line.category}-${line.label}`}
                pagination={false}
                size="middle"
                sticky
                scroll={{ x: 'max-content' }}
                locale={{ emptyText: 'No cost lines reported.' }}
              />
            </QCard>
          </div>
        ) : null}
      </AsyncSection>
    </PageContainer>
  );
}
