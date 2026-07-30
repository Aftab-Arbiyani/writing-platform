import type { ReportPriority, ReportSeverity, ReportStatus } from '@qalam/shared';
import type { ReactElement } from 'react';

import { StatusBadge } from '@/components/status-badge';

import { PRIORITY_TONE, SEVERITY_TONE, STATUS_TONE } from '../moderation.constants';

const cap = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

/** Priority pill (low→urgent), tone-mapped. */
export function PriorityBadge({ priority }: { priority: ReportPriority }): ReactElement {
  return (
    <StatusBadge
      status={priority}
      label={cap(priority)}
      tone={PRIORITY_TONE[priority] ?? 'neutral'}
    />
  );
}

/** Severity pill; renders a muted dash when unassessed. */
export function SeverityBadge({ severity }: { severity: ReportSeverity | null }): ReactElement {
  if (severity === null) {
    return <span className="text-ink-muted">—</span>;
  }
  return (
    <StatusBadge
      status={severity}
      label={cap(severity)}
      tone={SEVERITY_TONE[severity] ?? 'neutral'}
    />
  );
}

/** Report status pill with a moderation-specific tone map. */
export function ReportStatusBadge({ status }: { status: ReportStatus }): ReactElement {
  return (
    <StatusBadge status={status} label={cap(status)} tone={STATUS_TONE[status] ?? 'neutral'} />
  );
}
