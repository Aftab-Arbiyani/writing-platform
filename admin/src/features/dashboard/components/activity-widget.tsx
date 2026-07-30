import type { ReactElement } from 'react';

import { WidgetContainer } from '@/components/widget-container';

import { useDashboardStore } from '../stores/dashboard.store';

const WIDGET_ID = 'recent-activity';

/**
 * Recent activity feed. INTEGRATION GAP: the frozen backend exposes no activity/audit-log READ
 * endpoint (confirmed — no such controller). Rather than fabricate a feed, the widget shows an
 * honest "unavailable" state. It will render `ActivityTimeline` here once the backend ships the
 * endpoint. TODO(admin): wire to the audit-log/activity read endpoint when available.
 */
export function ActivityWidget(): ReactElement {
  const collapsed = useDashboardStore((state) => state.collapsedWidgets.includes(WIDGET_ID));
  const toggle = useDashboardStore((state) => state.toggleWidget);

  return (
    <WidgetContainer
      title="Recent activity"
      isEmpty
      emptyTitle="Activity feed unavailable"
      emptyDescription="New users, published pieces, reports, comments, and follows will appear here once the backend exposes an activity/audit-log endpoint."
      collapsible
      collapsed={collapsed}
      onToggleCollapse={() => toggle(WIDGET_ID)}
    >
      <span />
    </WidgetContainer>
  );
}
