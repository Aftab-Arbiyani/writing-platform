import { QCard, type QTagColor } from '@qalam/ui';
import { Table, type TableColumnsType } from 'antd';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import type { ReactElement } from 'react';

import { AlertPanel, type AlertItem, type AlertSeverity } from '@/components/alert-panel';
import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { StatusIndicator, type HealthStatus } from '@/components/status-indicator';
import { usePageTitle } from '@/hooks/use-page-title';
import { formatDateTime } from '@/lib/format';

import { AsyncSection } from '../components/async-section';
import { BoolIndicator } from '../components/bool-indicator';
import { DefinitionCard } from '../components/definition-card';
import { useConfigHealth } from '../hooks/use-system';
import type { ConfigHealthStatus, SecretRequirement, SecretStatus } from '../types/system.types';

/** Overall config status → tone + normalized health for the badge. */
const STATUS_TONE: Record<ConfigHealthStatus, QTagColor> = {
  ok: 'success',
  degraded: 'warning',
  error: 'danger',
};

const STATUS_LABEL: Record<ConfigHealthStatus, string> = {
  ok: 'Healthy',
  degraded: 'Degraded',
  error: 'Error',
};

/** How an issue should read, driven by the overall report status. */
const ISSUE_SEVERITY: Record<ConfigHealthStatus, AlertSeverity> = {
  ok: 'info',
  degraded: 'warning',
  error: 'critical',
};

/** Requirement → tone. `always`/`protected` matter more than `optional`. */
const REQUIREMENT_TONE: Record<SecretRequirement, QTagColor> = {
  always: 'danger',
  protected: 'warning',
  optional: 'neutral',
};

/** Monospace secret NAME (never a value — the API sends none). */
function SecretName({ name }: { name: string }): ReactElement {
  return <span className="font-mono text-sm text-ink">{name}</span>;
}

const SECRET_COLUMNS: TableColumnsType<SecretStatus> = [
  {
    title: 'Secret',
    dataIndex: 'name',
    key: 'name',
    render: (name: string) => <SecretName name={name} />,
  },
  { title: 'Purpose', dataIndex: 'purpose', key: 'purpose' },
  {
    title: 'Requirement',
    dataIndex: 'requirement',
    key: 'requirement',
    render: (requirement: SecretRequirement) => (
      <StatusBadge status={requirement} tone={REQUIREMENT_TONE[requirement]} />
    ),
  },
  {
    title: 'Present',
    dataIndex: 'present',
    key: 'present',
    render: (present: boolean) => (
      <BoolIndicator value={present} trueLabel="Present" falseLabel="Absent" />
    ),
  },
  {
    title: 'Valid',
    dataIndex: 'valid',
    key: 'valid',
    render: (valid: boolean) => (
      <BoolIndicator value={valid} trueLabel="Valid" falseLabel="Invalid" falseStatus="warning" />
    ),
  },
  {
    title: 'Placeholder',
    dataIndex: 'isPlaceholder',
    key: 'isPlaceholder',
    render: (isPlaceholder: boolean) => (
      <BoolIndicator
        value={isPlaceholder}
        trueLabel="Placeholder"
        falseLabel="No"
        trueStatus="warning"
      />
    ),
  },
];

/**
 * Configuration Health (P7.1) — the overall config status, environment fingerprint, a table of
 * every catalogued secret (presence / validity / placeholder as status indicators — NEVER a value,
 * the API sends none), and a panel of human-readable issues. Read-only, admin-gated.
 */
export function ConfigHealthPage(): ReactElement {
  usePageTitle('Configuration health');
  const query = useConfigHealth();
  const report = query.data;

  const overallStatus: HealthStatus = report
    ? report.status === 'ok'
      ? 'healthy'
      : report.status === 'degraded'
        ? 'warning'
        : 'critical'
    : 'unknown';

  const issues: AlertItem[] = (report?.issues ?? []).map((issue, index) => ({
    id: `issue-${index}`,
    severity: report ? ISSUE_SEVERITY[report.status] : 'warning',
    title: issue,
  }));

  return (
    <PageContainer>
      <PageHeader
        title="Configuration health"
        description="Secret presence and validity for this environment — never any secret values."
        actions={
          report ? (
            <StatusBadge
              status={report.status}
              tone={STATUS_TONE[report.status]}
              label={STATUS_LABEL[report.status]}
              size="md"
            />
          ) : null
        }
      />

      <AsyncSection
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        loadingRows={6}
      >
        {report ? (
          <div className="flex flex-col gap-6">
            <DefinitionCard
              title="Environment"
              icon={ShieldCheck}
              items={[
                {
                  label: 'Overall status',
                  value: (
                    <StatusIndicator status={overallStatus} label={STATUS_LABEL[report.status]} />
                  ),
                },
                { label: 'Environment', value: report.environment },
                {
                  label: 'Protected environment',
                  value: (
                    <BoolIndicator
                      value={report.protectedEnvironment}
                      trueLabel="Protected"
                      falseLabel="No"
                      trueStatus="warning"
                    />
                  ),
                },
                { label: 'Config version', value: report.configVersion },
                {
                  label: 'Fingerprint',
                  value: (
                    <span
                      className="block truncate font-mono text-sm text-ink"
                      title={report.fingerprint}
                    >
                      {report.fingerprint}
                    </span>
                  ),
                },
                { label: 'Checked at', value: formatDateTime(report.checkedAt) },
              ]}
            />

            <QCard as="section" padding="lg" className="flex flex-col gap-4">
              <h2 className="text-base font-semibold text-ink">Secrets</h2>
              <Table<SecretStatus>
                columns={SECRET_COLUMNS}
                dataSource={report.secrets}
                rowKey="name"
                pagination={false}
                size="middle"
                sticky
                scroll={{ x: 'max-content' }}
              />
            </QCard>

            <QCard as="section" padding="lg" className="flex flex-col gap-4">
              <h2 className="text-base font-semibold text-ink">Issues</h2>
              {issues.length > 0 ? (
                <AlertPanel alerts={issues} />
              ) : (
                <div className="flex items-center gap-2 text-sm text-ink-secondary">
                  <CheckCircle2 size={18} strokeWidth={1.75} className="text-success" aria-hidden />
                  No configuration issues detected.
                </div>
              )}
            </QCard>
          </div>
        ) : null}
      </AsyncSection>
    </PageContainer>
  );
}
