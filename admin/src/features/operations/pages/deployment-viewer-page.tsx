import { PERMISSIONS } from '@qalam/shared';
import { QCard } from '@qalam/ui';
import { Table, type TableColumnsType } from 'antd';
import { GitCommitHorizontal, Rocket, RotateCcw, Timer, TrendingUp } from 'lucide-react';
import type { ReactElement } from 'react';

import { EnvBadge } from '@/components/env-badge';
import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { usePermissions } from '@/hooks/use-permissions';
import { usePageTitle } from '@/hooks/use-page-title';
import { formatCount, formatDateTime, formatDuration, formatPercent } from '@/lib/format';

import { AsyncSection } from '../components/async-section';
import { DefinitionCard } from '../components/definition-card';
import { DeploymentStatusBadge } from '../components/operations-badges';
import { RolloutsSection } from '../components/rollouts-section';
import { useDeployments, useRollouts } from '../hooks/use-operations';
import type { DeploymentRecord } from '../types/operations.types';

function Mono({ value }: { value: string }): ReactElement {
  const text = value || '—';
  return (
    <span className="block truncate font-mono text-sm text-ink" title={text}>
      {text}
    </span>
  );
}

const DEPLOYMENT_COLUMNS: TableColumnsType<DeploymentRecord> = [
  {
    title: 'Version',
    dataIndex: 'version',
    key: 'version',
    render: (version: string) => <span className="font-medium text-ink">{version || '—'}</span>,
  },
  { title: 'Type', dataIndex: 'type', key: 'type' },
  { title: 'Environment', dataIndex: 'environment', key: 'environment' },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status: string) => <DeploymentStatusBadge status={status} />,
  },
  {
    title: 'Commit',
    dataIndex: 'gitSha',
    key: 'gitSha',
    render: (gitSha: string) => <span className="font-mono text-sm text-ink">{gitSha || '—'}</span>,
  },
  {
    title: 'Duration',
    dataIndex: 'durationSeconds',
    key: 'durationSeconds',
    align: 'right',
    className: 'tabular-nums',
    render: (durationSeconds: number | null) =>
      durationSeconds === null ? '—' : formatDuration(durationSeconds),
  },
  {
    title: 'When',
    dataIndex: 'at',
    key: 'at',
    render: (at: string) => formatDateTime(at),
  },
  {
    title: 'Note',
    dataIndex: 'note',
    key: 'note',
    render: (note: string | null) => note ?? '—',
  },
];

/**
 * Deployment Viewer (P7.4) — the running build's identity, the release roll-ups (success rate,
 * rollbacks, average duration), the deployment history, and the feature-rollout register. Reads are
 * admin-gated; the rollout percentage + kill switch are `settings.manage`-gated (server re-checks).
 */
export function DeploymentViewerPage(): ReactElement {
  usePageTitle('Deployments');
  const { can } = usePermissions();
  const deploymentsQuery = useDeployments();
  const rolloutsQuery = useRollouts();
  const canManage = can(PERMISSIONS.SettingsManage);

  const deployments = deploymentsQuery.data;

  return (
    <PageContainer>
      <PageHeader
        title="Deployments"
        description="The running build, release reliability, deployment history, and feature rollouts."
        actions={<EnvBadge />}
      />

      <AsyncSection
        isLoading={deploymentsQuery.isLoading}
        error={deploymentsQuery.error}
        onRetry={() => void deploymentsQuery.refetch()}
        loadingRows={6}
      >
        {deployments ? (
          <div className="flex flex-col gap-6">
            {/* Release roll-ups. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Deployments"
                value={formatCount(deployments.totalDeployments)}
                icon={Rocket}
                hint="Total recorded"
              />
              <StatCard
                label="Success rate"
                value={formatPercent(deployments.successRate)}
                icon={TrendingUp}
                hint="Successful deployments"
              />
              <StatCard
                label="Rollbacks"
                value={formatCount(deployments.rollbacks)}
                icon={RotateCcw}
                hint="Total rollbacks"
              />
              <StatCard
                label="Avg duration"
                value={
                  deployments.averageDurationSeconds === null
                    ? '—'
                    : formatDuration(deployments.averageDurationSeconds)
                }
                icon={Timer}
                hint="Mean deploy time"
              />
            </div>

            {/* Current build. */}
            <DefinitionCard
              title="Current build"
              icon={GitCommitHorizontal}
              items={[
                { label: 'Version', value: deployments.current.version || '—' },
                { label: 'Commit', value: <Mono value={deployments.current.gitSha} /> },
                { label: 'Environment', value: deployments.current.environment || '—' },
                { label: 'Release channel', value: deployments.current.releaseChannel || '—' },
                { label: 'Instance ID', value: <Mono value={deployments.current.instanceId} /> },
                {
                  label: 'Started at',
                  value: deployments.current.startedAt
                    ? formatDateTime(deployments.current.startedAt)
                    : '—',
                },
                {
                  label: 'Uptime',
                  value: formatDuration(deployments.current.uptimeSeconds),
                },
              ]}
            />

            {/* Deployment history. */}
            <QCard as="section" padding="lg" className="flex flex-col gap-4">
              <h2 className="text-base font-semibold text-ink">Deployment history</h2>
              <Table<DeploymentRecord>
                columns={DEPLOYMENT_COLUMNS}
                dataSource={deployments.recent}
                rowKey="id"
                pagination={false}
                size="middle"
                sticky
                scroll={{ x: 'max-content' }}
                locale={{ emptyText: 'No deployments recorded.' }}
              />
            </QCard>
          </div>
        ) : null}
      </AsyncSection>

      {/* Feature rollouts. */}
      <RolloutsSection
        rollouts={rolloutsQuery.data}
        isLoading={rolloutsQuery.isLoading}
        error={rolloutsQuery.error}
        onRetry={() => void rolloutsQuery.refetch()}
        canManage={canManage}
      />
    </PageContainer>
  );
}
