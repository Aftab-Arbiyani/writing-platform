import { QCard } from '@qalam/ui';
import { Table, type TableColumnsType } from 'antd';
import { Target } from 'lucide-react';
import type { ReactElement } from 'react';

import { EnvBadge } from '@/components/env-badge';
import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { usePageTitle } from '@/hooks/use-page-title';
import { formatCount, formatPercent } from '@/lib/format';

import { AsyncSection } from '../components/async-section';
import { SloStatusBadge } from '../components/operations-badges';
import { useSlo } from '../hooks/use-operations';
import type { SloObjective } from '../types/operations.types';

const NUMBER = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

/** Append an SLO's unit to a numeric value (`%` binds tight; other units get a space). */
function withUnit(value: number, unit: string): string {
  const formatted = NUMBER.format(value);
  if (unit === '' || unit === '%') return `${formatted}${unit}`;
  return `${formatted} ${unit}`;
}

const SLO_COLUMNS: TableColumnsType<SloObjective> = [
  {
    title: 'Objective',
    dataIndex: 'label',
    key: 'label',
    render: (label: string, objective) => (
      <div className="flex flex-col gap-0.5">
        <span className="font-medium text-ink">{label}</span>
        <span className="text-xs text-ink-muted">
          {objective.service} · {objective.kind}
        </span>
      </div>
    ),
  },
  {
    title: 'Target',
    key: 'target',
    align: 'right',
    className: 'tabular-nums',
    render: (_, objective) =>
      `${objective.comparator} ${withUnit(objective.objective, objective.unit)}`.trim(),
  },
  {
    title: 'SLI',
    dataIndex: 'sli',
    key: 'sli',
    align: 'right',
    className: 'tabular-nums',
    render: (sli: number | null, objective) => (sli === null ? '—' : withUnit(sli, objective.unit)),
  },
  {
    title: 'Error budget',
    dataIndex: 'errorBudgetRemaining',
    key: 'errorBudgetRemaining',
    align: 'right',
    className: 'tabular-nums',
    render: (remaining: number | null) => (remaining === null ? '—' : formatPercent(remaining)),
  },
  {
    title: 'Burn rate',
    dataIndex: 'burnRate',
    key: 'burnRate',
    align: 'right',
    className: 'tabular-nums',
    render: (burnRate: number | null) => (burnRate === null ? '—' : `${NUMBER.format(burnRate)}×`),
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (_, objective) => <SloStatusBadge status={objective.status} />,
  },
];

/**
 * SLO Dashboard (P7.4) — every service-level objective with its SLI vs target, error budget
 * remaining, burn rate, and status. The roll-up tiles (meeting / at-risk / breaching) sit above the
 * objective table. Read-only, admin-gated, auto-refreshing.
 */
export function SloDashboardPage(): ReactElement {
  usePageTitle('SLOs');
  const query = useSlo();
  const slo = query.data;

  const windowHours = slo ? Math.round(slo.windowSeconds / 3600) : 0;

  return (
    <PageContainer>
      <PageHeader
        title="Service-level objectives"
        description="SLI vs objective, error budget, and burn rate for every tracked SLO."
        actions={<EnvBadge />}
      />

      <AsyncSection
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        loadingRows={6}
      >
        {slo ? (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                label="Meeting"
                value={formatCount(slo.meeting)}
                icon={Target}
                hint={`Over the last ${windowHours}h window`}
              />
              <StatCard
                label="At risk"
                value={formatCount(slo.atRisk)}
                hint="Budget under pressure"
              />
              <StatCard
                label="Breaching"
                value={formatCount(slo.breaching)}
                hint="Budget exhausted"
              />
            </div>

            <QCard as="section" padding="lg" className="flex flex-col gap-4">
              <h2 className="text-base font-semibold text-ink">Objectives</h2>
              <Table<SloObjective>
                columns={SLO_COLUMNS}
                dataSource={slo.objectives}
                rowKey="id"
                pagination={false}
                size="middle"
                sticky
                scroll={{ x: 'max-content' }}
                locale={{ emptyText: 'No SLOs configured.' }}
              />
            </QCard>
          </div>
        ) : null}
      </AsyncSection>
    </PageContainer>
  );
}
