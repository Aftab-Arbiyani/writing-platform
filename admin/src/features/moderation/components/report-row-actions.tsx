import { PERMISSIONS, ReportStatus } from '@qalam/shared';
import { ChevronsUp, Eye, Gavel, UserPlus } from 'lucide-react';
import type { ReactElement } from 'react';

import { ActionMenu, type ActionMenuItem } from '@/components/action-menu';
import { usePermissions } from '@/hooks/use-permissions';

import type { Report } from '../types/moderation.types';

interface ReportRowActionsProps {
  report: Report;
  onView: () => void;
  onAssign: () => void;
  onEscalate: () => void;
  onResolve: () => void;
}

/** Per-row moderation actions. Reads = `report.review`; triage/resolve = `report.resolve`. */
export function ReportRowActions({
  report,
  onView,
  onAssign,
  onEscalate,
  onResolve,
}: ReportRowActionsProps): ReactElement {
  const { can } = usePermissions();
  const terminal =
    report.status === ReportStatus.Resolved || report.status === ReportStatus.Dismissed;
  const items: ActionMenuItem[] = [
    { key: 'view', label: 'View report', icon: Eye, onClick: onView },
  ];

  if (can(PERMISSIONS.ReportResolve)) {
    items.push(
      { key: 'assign', label: 'Assign moderator', icon: UserPlus, onClick: onAssign },
      {
        key: 'escalate',
        label: 'Escalate',
        icon: ChevronsUp,
        disabled: terminal,
        onClick: onEscalate,
      },
      { key: 'resolve', label: 'Resolve…', icon: Gavel, disabled: terminal, onClick: onResolve },
    );
  }

  return (
    <ActionMenu
      items={items}
      ariaLabel={`Actions for report ${report.id.slice(0, 8)}`}
      testId={`report-actions-${report.id}`}
    />
  );
}
