import { QSectionHeader } from '@qalam/ui';
import { BarChart3, FileText, Flag, ScrollText, ShieldCheck, Users } from 'lucide-react';
import type { ReactElement } from 'react';

import { DashboardGrid } from '@/components/dashboard-grid';
import { QuickActionCard } from '@/components/quick-action-card';
import { ROUTES } from '@/lib/routes';

/**
 * Quick actions — navigation only (they open placeholder admin sections; A3 implements none of those
 * modules). Every target is a real route. "System Settings" is omitted (no settings route/module —
 * out of scope); the moderation queue is reached via "Review reports".
 */
export function QuickActionsWidget(): ReactElement {
  return (
    <section className="flex flex-col gap-3">
      <QSectionHeader title="Quick actions" description="Jump to an admin area." />
      <DashboardGrid minColWidth={240}>
        <QuickActionCard
          icon={Users}
          label="View users"
          description="Accounts & verification"
          to={ROUTES.users}
        />
        <QuickActionCard
          icon={Flag}
          label="Review reports"
          description="Moderation queue"
          to={ROUTES.reports}
        />
        <QuickActionCard
          icon={ShieldCheck}
          label="Moderators"
          description="Team & access"
          to={ROUTES.moderators}
        />
        <QuickActionCard
          icon={BarChart3}
          label="Analytics"
          description="Platform analytics"
          to={ROUTES.analytics}
        />
        <QuickActionCard
          icon={ScrollText}
          label="Audit logs"
          description="Admin action history"
          to={ROUTES.auditLogs}
        />
        <QuickActionCard
          icon={FileText}
          label="Content"
          description="Published pieces"
          to={ROUTES.pieces}
        />
      </DashboardGrid>
    </section>
  );
}
