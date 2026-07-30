import { PERMISSIONS } from '@qalam/shared';
import { QButton, QCard, QTag } from '@qalam/ui';
import { Table, type TableColumnsType } from 'antd';
import { BellRing, BookOpen, CalendarClock, Plus } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { EnvBadge } from '@/components/env-badge';
import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { usePermissions } from '@/hooks/use-permissions';
import { usePageTitle } from '@/hooks/use-page-title';
import { formatCount, formatDateTime } from '@/lib/format';

import { AsyncSection } from '../components/async-section';
import { BoolIndicator } from '../components/bool-indicator';
import { MaintenanceWindowCreateModal } from '../components/maintenance-window-create-modal';
import { AlertSeverityBadge } from '../components/operations-badges';
import { useAlerts, useMaintenanceWindows, useRunbooks } from '../hooks/use-operations';
import type { AlertEvaluation, MaintenanceWindow, Runbook } from '../types/operations.types';

function measuredText(value: number | null, unit: string): string {
  if (value === null) return '—';
  return unit ? `${formatCount(value)} ${unit}` : formatCount(value);
}

const ALERT_COLUMNS: TableColumnsType<AlertEvaluation> = [
  {
    title: 'Alert',
    dataIndex: 'label',
    key: 'label',
    render: (label: string) => <span className="font-medium text-ink">{label}</span>,
  },
  { title: 'Category', dataIndex: 'category', key: 'category' },
  {
    title: 'Severity',
    dataIndex: 'severity',
    key: 'severity',
    render: (_, alert) => <AlertSeverityBadge severity={alert.severity} />,
  },
  {
    title: 'State',
    key: 'state',
    render: (_, alert) =>
      alert.suppressed ? (
        <QTag color="neutral" size="sm">
          Suppressed
        </QTag>
      ) : (
        <BoolIndicator
          value={alert.firing}
          trueLabel="Firing"
          falseLabel="OK"
          trueStatus="critical"
        />
      ),
  },
  {
    title: 'Measured',
    key: 'measured',
    align: 'right',
    className: 'tabular-nums',
    render: (_, alert) => measuredText(alert.measured, alert.unit),
  },
  {
    title: 'Threshold',
    key: 'threshold',
    align: 'right',
    className: 'tabular-nums',
    render: (_, alert) =>
      alert.unit ? `${formatCount(alert.threshold)} ${alert.unit}` : formatCount(alert.threshold),
  },
  {
    title: 'Runbook',
    dataIndex: 'runbookId',
    key: 'runbookId',
    render: (runbookId: string | null) =>
      runbookId ? (
        <span className="font-mono text-sm text-ink">{runbookId}</span>
      ) : (
        <span className="text-ink-muted">—</span>
      ),
  },
];

const MAINTENANCE_COLUMNS: TableColumnsType<MaintenanceWindow> = [
  {
    title: 'Reason',
    dataIndex: 'reason',
    key: 'reason',
    render: (reason: string) => <span className="font-medium text-ink">{reason}</span>,
  },
  {
    title: 'Categories',
    dataIndex: 'categories',
    key: 'categories',
    render: (categories: string[]) =>
      categories.length > 0 ? (
        <span className="flex flex-wrap gap-1">
          {categories.map((category) => (
            <QTag key={category} color="neutral" size="sm">
              {category}
            </QTag>
          ))}
        </span>
      ) : (
        <span className="text-ink-muted">All</span>
      ),
  },
  {
    title: 'Starts',
    dataIndex: 'startsAt',
    key: 'startsAt',
    render: (startsAt: string) => formatDateTime(startsAt),
  },
  {
    title: 'Ends',
    dataIndex: 'endsAt',
    key: 'endsAt',
    render: (endsAt: string) => formatDateTime(endsAt),
  },
];

const RUNBOOK_COLUMNS: TableColumnsType<Runbook> = [
  {
    title: 'Runbook',
    dataIndex: 'title',
    key: 'title',
    render: (title: string) => <span className="font-medium text-ink">{title}</span>,
  },
  { title: 'Symptom', dataIndex: 'symptom', key: 'symptom' },
  { title: 'Severity', dataIndex: 'severity', key: 'severity' },
  {
    title: 'Linked alerts',
    dataIndex: 'linkedAlerts',
    key: 'linkedAlerts',
    align: 'right',
    className: 'tabular-nums',
    render: (linkedAlerts: string[]) => formatCount(linkedAlerts.length),
  },
];

function RunbookSteps({ runbook }: { runbook: Runbook }): ReactElement {
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex list-decimal flex-col gap-1 ps-5 text-sm text-ink">
        {runbook.steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>
      {runbook.linkedAlerts.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs text-ink-secondary">Linked alerts:</span>
          {runbook.linkedAlerts.map((alertId) => (
            <QTag key={alertId} color="info" size="sm">
              {alertId}
            </QTag>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Alert Dashboard (P7.4). Read-only alert-rule evaluations (firing / suppressed, severity, measured
 * vs threshold, runbook reference) with the active maintenance windows that suppress them, plus the
 * runbook catalogue. Scheduling a maintenance window is `settings.manage`-gated. Auto-refreshing.
 */
export function AlertDashboardPage(): ReactElement {
  usePageTitle('Alerts');
  const { can } = usePermissions();
  const alertsQuery = useAlerts();
  const windowsQuery = useMaintenanceWindows();
  const runbooksQuery = useRunbooks();
  const [createOpen, setCreateOpen] = useState(false);
  const canManage = can(PERMISSIONS.SettingsManage);

  const alerts = alertsQuery.data;

  return (
    <PageContainer>
      <PageHeader
        title="Alerts"
        description="Alert-rule evaluations, active maintenance windows, and the runbook catalogue."
        actions={
          <div className="flex items-center gap-2">
            {canManage ? (
              <QButton variant="primary" size="sm" icon={Plus} onClick={() => setCreateOpen(true)}>
                Schedule maintenance
              </QButton>
            ) : null}
            <EnvBadge />
          </div>
        }
      />

      {/* Alert evaluations. */}
      <QCard as="section" padding="lg" className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <BellRing size={18} strokeWidth={1.75} className="text-ink-secondary" aria-hidden />
          <h2 className="text-base font-semibold text-ink">Alert evaluations</h2>
        </div>
        <AsyncSection
          isLoading={alertsQuery.isLoading}
          error={alertsQuery.error}
          onRetry={() => void alertsQuery.refetch()}
          loadingRows={6}
        >
          {alerts ? (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <StatCard
                  label="Firing"
                  value={formatCount(alerts.firing)}
                  icon={BellRing}
                  hint="Currently breaching threshold"
                />
                <StatCard
                  label="Suppressed"
                  value={formatCount(alerts.suppressed)}
                  icon={CalendarClock}
                  hint="Silenced by a maintenance window"
                />
              </div>
              <Table<AlertEvaluation>
                columns={ALERT_COLUMNS}
                dataSource={alerts.evaluations}
                rowKey="id"
                pagination={false}
                size="middle"
                sticky
                scroll={{ x: 'max-content' }}
              />
            </div>
          ) : null}
        </AsyncSection>
      </QCard>

      {/* Active maintenance windows. */}
      <QCard as="section" padding="lg" className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <CalendarClock size={18} strokeWidth={1.75} className="text-ink-secondary" aria-hidden />
          <h2 className="text-base font-semibold text-ink">Maintenance windows</h2>
        </div>
        <AsyncSection
          isLoading={windowsQuery.isLoading}
          error={windowsQuery.error}
          onRetry={() => void windowsQuery.refetch()}
          loadingRows={3}
        >
          <Table<MaintenanceWindow>
            columns={MAINTENANCE_COLUMNS}
            dataSource={windowsQuery.data ?? []}
            rowKey="id"
            pagination={false}
            size="middle"
            sticky
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: 'No active maintenance windows.' }}
          />
        </AsyncSection>
      </QCard>

      {/* Runbook catalogue. */}
      <QCard as="section" padding="lg" className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <BookOpen size={18} strokeWidth={1.75} className="text-ink-secondary" aria-hidden />
          <h2 className="text-base font-semibold text-ink">Runbooks</h2>
        </div>
        <AsyncSection
          isLoading={runbooksQuery.isLoading}
          error={runbooksQuery.error}
          onRetry={() => void runbooksQuery.refetch()}
          loadingRows={3}
        >
          <Table<Runbook>
            columns={RUNBOOK_COLUMNS}
            dataSource={runbooksQuery.data ?? []}
            rowKey="id"
            pagination={false}
            size="middle"
            sticky
            scroll={{ x: 'max-content' }}
            expandable={{
              expandedRowRender: (runbook) => <RunbookSteps runbook={runbook} />,
              rowExpandable: (runbook) => runbook.steps.length > 0,
            }}
            locale={{ emptyText: 'No runbooks catalogued.' }}
          />
        </AsyncSection>
      </QCard>

      <MaintenanceWindowCreateModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </PageContainer>
  );
}
