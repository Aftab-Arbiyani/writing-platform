import { PERMISSIONS } from '@qalam/shared';
import { Database, HardDrive, ListChecks, Server, Workflow, Zap } from 'lucide-react';
import { memo, type ReactElement } from 'react';

import { DashboardGrid } from '@/components/dashboard-grid';
import { HealthStatusCard } from '@/components/health-status-card';
import type { HealthStatus } from '@/components/status-indicator';
import { WidgetContainer } from '@/components/widget-container';
import { usePermissions } from '@/hooks/use-permissions';

import { useQueues } from '../hooks/use-queues';
import { useSystemHealth } from '../hooks/use-system-health';
import { useDashboardStore } from '../stores/dashboard.store';

const WIDGET_ID = 'system-health';

/**
 * System health panel — API/DB/Redis/Queues/Storage from the public `/health/*` probes, plus a
 * Workers tile derived from `/admin/queues` (connected worker count). Auto-refreshes. Collapsible.
 */
export const SystemHealthWidget = memo(function SystemHealthWidget(): ReactElement {
  const health = useSystemHealth();
  const queues = useQueues();
  const { can } = usePermissions();
  const collapsed = useDashboardStore((state) => state.collapsedWidgets.includes(WIDGET_ID));
  const toggle = useDashboardStore((state) => state.toggleWidget);

  const data = health.data;

  const workerStatus: HealthStatus = (() => {
    if (!can(PERMISSIONS.AdminDashboard) || queues.isLoading || queues.isError || !queues.data) {
      return 'unknown';
    }
    if (queues.data.length === 0) return 'unknown';
    return queues.data.some((queue) => queue.workers > 0) ? 'healthy' : 'critical';
  })();
  const totalWorkers = queues.data?.reduce((sum, queue) => sum + queue.workers, 0);

  return (
    <WidgetContainer
      title="System health"
      isLoading={health.isLoading}
      error={health.error}
      onRetry={() => void health.refetch()}
      collapsible
      collapsed={collapsed}
      onToggleCollapse={() => toggle(WIDGET_ID)}
    >
      <DashboardGrid minColWidth={180}>
        <HealthStatusCard name="API" status={data?.api ?? 'unknown'} icon={Server} />
        <HealthStatusCard name="Database" status={data?.database ?? 'unknown'} icon={Database} />
        <HealthStatusCard name="Redis" status={data?.redis ?? 'unknown'} icon={Zap} />
        <HealthStatusCard name="Queues" status={data?.queues ?? 'unknown'} icon={ListChecks} />
        <HealthStatusCard name="Storage" status={data?.storage ?? 'unknown'} icon={HardDrive} />
        <HealthStatusCard
          name="Workers"
          status={workerStatus}
          icon={Workflow}
          detail={totalWorkers === undefined ? undefined : `${totalWorkers} connected`}
        />
      </DashboardGrid>
    </WidgetContainer>
  );
});
