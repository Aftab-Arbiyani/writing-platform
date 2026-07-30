import { Flag, ShieldCheck } from 'lucide-react';
import type { ReactElement } from 'react';

import { DashboardGrid } from '@/components/dashboard-grid';
import { QuickActionCard } from '@/components/quick-action-card';
import { WidgetContainer } from '@/components/widget-container';
import { ROUTES } from '@/lib/routes';

import { useDashboardStore } from '../stores/dashboard.store';

const WIDGET_ID = 'moderation';

/**
 * Moderation summary. INTEGRATION GAP: the moderation workflow (reports, review queue, appeals) is
 * NOT built in the backend (confirmed — no reports/moderation controller or entity; CLAUDE.md says
 * so). Live counts are therefore unavailable and are NOT faked. The quick moderation shortcuts still
 * navigate to the (placeholder) moderation areas. TODO(admin): show real counts once reports ship.
 */
export function ModerationWidget(): ReactElement {
  const collapsed = useDashboardStore((state) => state.collapsedWidgets.includes(WIDGET_ID));
  const toggle = useDashboardStore((state) => state.toggleWidget);

  return (
    <WidgetContainer
      title="Moderation summary"
      collapsible
      collapsed={collapsed}
      onToggleCollapse={() => toggle(WIDGET_ID)}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-secondary">
          Live moderation counts (pending reports, review queue, reported users/pieces, appeals) are
          unavailable — the moderation workflow isn’t built in the backend yet. Use the shortcuts
          below to open the moderation areas.
        </p>
        <DashboardGrid minColWidth={200}>
          <QuickActionCard icon={Flag} label="Review reports" to={ROUTES.reports} />
          <QuickActionCard icon={ShieldCheck} label="Moderators" to={ROUTES.moderators} />
        </DashboardGrid>
      </div>
    </WidgetContainer>
  );
}
