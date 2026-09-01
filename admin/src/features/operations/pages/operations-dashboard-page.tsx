import { QCard, QTag } from '@qalam/ui';
import { Table, type TableColumnsType } from 'antd';
import {
  Activity,
  BellRing,
  CircleCheck,
  DollarSign,
  Gauge,
  Rocket,
  RotateCcw,
  ShieldCheck,
  Siren,
  Target,
  Timer,
} from 'lucide-react';
import type { ReactElement } from 'react';

import { DashboardGrid } from '@/components/dashboard-grid';
import { EnvBadge } from '@/components/env-badge';
import { HealthStatusCard } from '@/components/health-status-card';
import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { usePageTitle } from '@/hooks/use-page-title';
import { formatCount, formatPercent, formatUsd } from '@/lib/format';

import { AsyncSection } from '@/components/async-section';
import { BoolIndicator } from '../components/bool-indicator';
import { OperationalHealthBadge } from '../components/operations-badges';
import { componentStatusLabel, componentStatusToHealth } from '../components/operations-status';
import {
  useOperationsGovernance,
  useOperationsHealth,
  useOperationsSummary,
} from '../hooks/use-operations';
import type { GovernanceCheck } from '../types/operations.types';

const CHECK_COLUMNS: TableColumnsType<GovernanceCheck> = [
  {
    title: 'Control',
    dataIndex: 'control',
    key: 'control',
    render: (control: string) => <span className="font-medium text-ink">{control}</span>,
  },
  {
    title: 'Status',
    dataIndex: 'ok',
    key: 'ok',
    render: (ok: boolean) => (
      <BoolIndicator value={ok} trueLabel="Centralized" falseLabel="Gap" falseStatus="warning" />
    ),
  },
  { title: 'Detail', dataIndex: 'detail', key: 'detail' },
];

/**
 * Operations Overview (P7.4) — the single-glance console home. Three independent reads: the summary
 * roll-up drives the KPI tiles, the operational-health snapshot drives the component grid, and the
 * governance report drives the centralization statement + control checks. Read-only, admin-gated,
 * auto-refreshing.
 */
export function OperationsDashboardPage(): ReactElement {
  usePageTitle('Operations');
  const summaryQuery = useOperationsSummary();
  const healthQuery = useOperationsHealth();
  const governanceQuery = useOperationsGovernance();

  const summary = summaryQuery.data;
  const health = healthQuery.data;
  const governance = governanceQuery.data;

  return (
    <PageContainer>
      <PageHeader
        title="Operations"
        description="Platform reliability at a glance — health, SLOs, alerts, incidents, deployments, and cost."
        actions={
          <div className="flex items-center gap-2">
            {summary ? <OperationalHealthBadge health={summary.health} size="md" /> : null}
            <EnvBadge />
          </div>
        }
      />

      {/* Summary KPIs. */}
      <AsyncSection
        isLoading={summaryQuery.isLoading}
        error={summaryQuery.error}
        onRetry={() => void summaryQuery.refetch()}
        loadingRows={6}
      >
        {summary ? (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard
                label="Readiness"
                value={summary.ready ? 'Ready' : 'Not ready'}
                icon={Gauge}
                hint={summary.ready ? 'Accepting traffic' : 'Not serving traffic'}
              />
              <StatCard
                label="Open incidents"
                value={formatCount(summary.incidents.open)}
                icon={Siren}
                hint={summary.incidents.open === 0 ? 'All clear' : 'Active incidents'}
              />
              <StatCard
                label="Alerts firing"
                value={formatCount(summary.alerts.firing)}
                icon={BellRing}
                hint={`${formatCount(summary.alerts.suppressed)} suppressed`}
              />
              <StatCard
                label="SLOs meeting"
                value={`${formatCount(summary.slo.meeting)}/${formatCount(summary.slo.total)}`}
                icon={Target}
                hint={`${formatCount(summary.slo.atRisk)} at risk · ${formatCount(summary.slo.breaching)} breaching`}
              />
              <StatCard
                label="Deploy success"
                value={formatPercent(summary.deployment.successRate)}
                icon={Rocket}
                hint={`Version ${summary.deployment.version || '—'}`}
              />
              <StatCard
                label="Rollbacks"
                value={formatCount(summary.deployment.rollbacks)}
                icon={RotateCcw}
                hint="Total rollbacks"
              />
              <StatCard
                label="Availability"
                value={formatPercent(summary.reliability.availabilityRatio)}
                icon={Activity}
                hint="Rolling window"
              />
              <StatCard
                label="MTTR"
                value={
                  summary.reliability.mttrMinutes === null
                    ? '—'
                    : `${formatCount(summary.reliability.mttrMinutes)} min`
                }
                icon={Timer}
                hint="Mean time to resolve"
              />
              <StatCard
                label="Daily cost"
                value={formatUsd(summary.costDailyUsd)}
                icon={DollarSign}
                hint="Estimated run rate"
              />
            </div>

            {summary.controls.length > 0 ? (
              <QCard as="section" padding="lg" className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck
                    size={18}
                    strokeWidth={1.75}
                    className="text-ink-secondary"
                    aria-hidden
                  />
                  <h2 className="text-base font-semibold text-ink">Operational controls</h2>
                </div>
                <ul className="flex flex-wrap gap-2">
                  {summary.controls.map((control) => (
                    <li key={control}>
                      <QTag color="success" size="md">
                        {control}
                      </QTag>
                    </li>
                  ))}
                </ul>
              </QCard>
            ) : null}
          </div>
        ) : null}
      </AsyncSection>

      {/* Operational-health components. */}
      <QCard as="section" padding="lg" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-ink">Operational health</h2>
          {health ? <p className="text-sm text-ink-secondary">{health.statusSummary}</p> : null}
        </div>
        <AsyncSection
          isLoading={healthQuery.isLoading}
          error={healthQuery.error}
          onRetry={() => void healthQuery.refetch()}
          loadingRows={4}
        >
          {health ? (
            <DashboardGrid minColWidth={220}>
              {health.components.map((component) => (
                <HealthStatusCard
                  key={component.name}
                  name={component.name}
                  status={componentStatusToHealth(component.status)}
                  detail={component.detail || componentStatusLabel(component.status)}
                />
              ))}
            </DashboardGrid>
          ) : null}
        </AsyncSection>
      </QCard>

      {/* Governance centralization statement + checks. */}
      <QCard as="section" padding="lg" className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <CircleCheck size={18} strokeWidth={1.75} className="text-ink-secondary" aria-hidden />
          <h2 className="text-base font-semibold text-ink">Governance</h2>
        </div>
        <AsyncSection
          isLoading={governanceQuery.isLoading}
          error={governanceQuery.error}
          onRetry={() => void governanceQuery.refetch()}
          loadingRows={4}
        >
          {governance ? (
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center gap-3">
                <BoolIndicator
                  value={governance.centralized}
                  trueLabel="Centralized"
                  falseLabel="Decentralized"
                  falseStatus="warning"
                />
                <p className="min-w-0 flex-1 text-sm text-ink-secondary">{governance.statement}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="SLOs" value={formatCount(governance.catalogues.slos)} />
                <StatCard
                  label="Alert rules"
                  value={formatCount(governance.catalogues.alertRules)}
                />
                <StatCard label="Runbooks" value={formatCount(governance.catalogues.runbooks)} />
                <StatCard
                  label="Chaos scenarios"
                  value={formatCount(governance.catalogues.chaosScenarios)}
                />
              </div>

              <Table<GovernanceCheck>
                columns={CHECK_COLUMNS}
                dataSource={governance.checks}
                rowKey="control"
                pagination={false}
                size="middle"
                sticky
                scroll={{ x: 'max-content' }}
              />
            </div>
          ) : null}
        </AsyncSection>
      </QCard>
    </PageContainer>
  );
}
