import { PERMISSIONS } from '@qalam/shared';
import { memo, type ReactElement } from 'react';

import { AccessDenied } from '@/components/access-denied';
import { AlertPanel } from '@/components/alert-panel';
import { WidgetContainer } from '@/components/widget-container';
import { usePermissions } from '@/hooks/use-permissions';

import { deriveAlerts } from '../lib/derive-alerts';
import { useQueues } from '../hooks/use-queues';
import { useSystemNotifications } from '../hooks/use-system-notifications';
import { useDashboardStore } from '../stores/dashboard.store';

const WIDGET_ID = 'alerts';

/**
 * System alerts — derived client-side (no backend alerts endpoint): failed/stalled/paused queues
 * from `/admin/queues` + admin broadcasts from `/admin/system-notifications`. Each source is gated
 * by its own permission; an operator with neither sees access-denied. Collapsible.
 */
export const AlertsWidget = memo(function AlertsWidget(): ReactElement {
  const { can } = usePermissions();
  const canQueues = can(PERMISSIONS.AdminDashboard);
  const canNotices = can(PERMISSIONS.NotificationManage);
  const queues = useQueues();
  const notices = useSystemNotifications(10);
  const collapsed = useDashboardStore((state) => state.collapsedWidgets.includes(WIDGET_ID));
  const toggle = useDashboardStore((state) => state.toggleWidget);

  const alerts = deriveAlerts(queues.data ?? [], notices.data ?? []);
  const isLoading = queues.isLoading || notices.isLoading;
  const error = queues.error ?? notices.error ?? undefined;

  const retry = (): void => {
    if (canQueues) void queues.refetch();
    if (canNotices) void notices.refetch();
  };

  return (
    <WidgetContainer
      title="System alerts"
      isLoading={isLoading}
      error={error}
      onRetry={retry}
      isEmpty={(canQueues || canNotices) && !isLoading && !error && alerts.length === 0}
      emptyTitle="All clear"
      emptyDescription="No failed jobs, stalled queues, or active notices."
      collapsible
      collapsed={collapsed}
      onToggleCollapse={() => toggle(WIDGET_ID)}
    >
      {!canQueues && !canNotices ? (
        <AccessDenied description="Viewing alerts requires the admin.dashboard or notification.manage permission." />
      ) : (
        <AlertPanel alerts={alerts} />
      )}
    </WidgetContainer>
  );
});
