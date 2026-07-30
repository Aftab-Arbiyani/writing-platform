import { PERMISSIONS } from '@qalam/shared';
import { QButton } from '@qalam/ui';
import { type TableColumnsType } from 'antd';
import { Plus } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { DataTable } from '@/components/data-table';
import { EnvBadge } from '@/components/env-badge';
import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { usePermissions } from '@/hooks/use-permissions';
import { usePageTitle } from '@/hooks/use-page-title';
import { formatDateTime } from '@/lib/format';

import { IncidentCreateModal } from '../components/incident-create-modal';
import { IncidentDetailDrawer } from '../components/incident-detail-drawer';
import { IncidentSeverityBadge, IncidentStatusBadge } from '../components/operations-badges';
import { useIncidents } from '../hooks/use-operations';
import type { Incident } from '../types/operations.types';

/**
 * Incident Dashboard (P7.4) — the incident register. The list is admin-gated + auto-refreshing;
 * declaring an incident and the per-incident actions (status transition, notes, resolve) are
 * `settings.manage`-gated (the server re-checks). Row → drawer opens the timeline + actions.
 */
export function IncidentDashboardPage(): ReactElement {
  usePageTitle('Incidents');
  const { can } = usePermissions();
  const query = useIncidents();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const canManage = can(PERMISSIONS.SettingsManage);

  const columns: TableColumnsType<Incident> = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (title: string) => <span className="font-medium text-ink">{title}</span>,
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      render: (_, incident) => <IncidentSeverityBadge severity={incident.severity} />,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (_, incident) => <IncidentStatusBadge status={incident.status} />,
    },
    {
      title: 'Service',
      dataIndex: 'service',
      key: 'service',
      render: (service: string | null) => service ?? '—',
    },
    {
      title: 'Declared',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (createdAt: string) => formatDateTime(createdAt),
    },
    {
      title: 'TTR',
      dataIndex: 'timeToResolveMinutes',
      key: 'ttr',
      align: 'right',
      className: 'tabular-nums',
      render: (minutes: number | null) => (minutes === null ? '—' : `${minutes} min`),
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, incident) => (
        <QButton variant="ghost" size="sm" onClick={() => setSelectedId(incident.id)}>
          View
        </QButton>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Incidents"
        description="The incident register — declare, triage, and resolve operational incidents."
        actions={
          <div className="flex items-center gap-2">
            {canManage ? (
              <QButton variant="primary" size="sm" icon={Plus} onClick={() => setCreateOpen(true)}>
                Declare incident
              </QButton>
            ) : null}
            <EnvBadge />
          </div>
        }
      />

      <DataTable<Incident>
        columns={columns}
        data={query.data ?? []}
        rowKey="id"
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle="No incidents"
        emptyDescription="No incidents have been declared."
      />

      <IncidentCreateModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <IncidentDetailDrawer incidentId={selectedId} onClose={() => setSelectedId(null)} />
    </PageContainer>
  );
}
