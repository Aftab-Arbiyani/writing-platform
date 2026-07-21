import { QTag, type QTagColor } from '@qalam/ui';
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';

import type {
  AlertSeverity,
  CostTrend,
  IncidentSeverity,
  IncidentStatus,
  OperationalHealth,
  RolloutStrategy,
  SloStatus,
  TraceStatus,
} from '../types/operations.types';

/**
 * The Operations feature's status vocabulary (P7.4) — one badge component per domain status, each a
 * thin wrapper over the shared `QTag` with a status → tone + label map. Keeping every mapping here
 * means a status renders identically in the summary tiles, tables, and drawers. Tone is never the
 * only signal: each pill also carries an explicit word (a11y).
 */

// ── Operational health (summary + health.overall) ────────────────────────────

const OPERATIONAL_HEALTH: Record<OperationalHealth, { tone: QTagColor; label: string }> = {
  healthy: { tone: 'success', label: 'Healthy' },
  degraded: { tone: 'warning', label: 'Degraded' },
  unhealthy: { tone: 'danger', label: 'Unhealthy' },
};

export function OperationalHealthBadge({
  health,
  size = 'sm',
}: {
  health: OperationalHealth;
  size?: 'sm' | 'md';
}): ReactElement {
  const { tone, label } = OPERATIONAL_HEALTH[health];
  return (
    <QTag color={tone} size={size}>
      {label}
    </QTag>
  );
}

// ── SLO status ────────────────────────────────────────────────────────────────

const SLO_STATUS: Record<SloStatus, { tone: QTagColor; label: string }> = {
  meeting: { tone: 'success', label: 'Meeting' },
  at_risk: { tone: 'warning', label: 'At risk' },
  breaching: { tone: 'danger', label: 'Breaching' },
  no_data: { tone: 'neutral', label: 'No data' },
};

export function SloStatusBadge({ status }: { status: SloStatus }): ReactElement {
  const { tone, label } = SLO_STATUS[status];
  return (
    <QTag color={tone} size="sm">
      {label}
    </QTag>
  );
}

// ── Alert severity ────────────────────────────────────────────────────────────

const ALERT_SEVERITY: Record<AlertSeverity, { tone: QTagColor; label: string }> = {
  critical: { tone: 'danger', label: 'Critical' },
  warning: { tone: 'warning', label: 'Warning' },
  info: { tone: 'info', label: 'Info' },
};

export function AlertSeverityBadge({ severity }: { severity: AlertSeverity }): ReactElement {
  const { tone, label } = ALERT_SEVERITY[severity];
  return (
    <QTag color={tone} size="sm">
      {label}
    </QTag>
  );
}

// ── Incident severity + status ────────────────────────────────────────────────

const INCIDENT_SEVERITY: Record<IncidentSeverity, { tone: QTagColor; label: string }> = {
  sev1: { tone: 'danger', label: 'SEV1' },
  sev2: { tone: 'danger', label: 'SEV2' },
  sev3: { tone: 'warning', label: 'SEV3' },
  sev4: { tone: 'neutral', label: 'SEV4' },
};

export function IncidentSeverityBadge({ severity }: { severity: IncidentSeverity }): ReactElement {
  const { tone, label } = INCIDENT_SEVERITY[severity];
  return (
    <QTag color={tone} size="sm">
      {label}
    </QTag>
  );
}

const INCIDENT_STATUS: Record<IncidentStatus, { tone: QTagColor; label: string }> = {
  open: { tone: 'danger', label: 'Open' },
  acknowledged: { tone: 'warning', label: 'Acknowledged' },
  investigating: { tone: 'warning', label: 'Investigating' },
  identified: { tone: 'info', label: 'Identified' },
  monitoring: { tone: 'info', label: 'Monitoring' },
  resolved: { tone: 'success', label: 'Resolved' },
};

export function IncidentStatusBadge({ status }: { status: IncidentStatus }): ReactElement {
  const { tone, label } = INCIDENT_STATUS[status];
  return (
    <QTag color={tone} size="sm">
      {label}
    </QTag>
  );
}

// ── Deployment status (open enum — best-effort tone) ──────────────────────────

const DEPLOYMENT_TONE: Record<string, QTagColor> = {
  succeeded: 'success',
  success: 'success',
  completed: 'success',
  in_progress: 'info',
  pending: 'info',
  rolled_back: 'warning',
  rollback: 'warning',
  failed: 'danger',
  error: 'danger',
};

function humanizeToken(value: string): string {
  const spaced = value.replace(/[_-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function DeploymentStatusBadge({ status }: { status: string }): ReactElement {
  const tone = DEPLOYMENT_TONE[status.toLowerCase()] ?? 'neutral';
  return (
    <QTag color={tone} size="sm">
      {humanizeToken(status)}
    </QTag>
  );
}

// ── Trace status ──────────────────────────────────────────────────────────────

export function TraceStatusBadge({ status }: { status: TraceStatus }): ReactElement {
  return (
    <QTag color={status === 'ok' ? 'success' : 'danger'} size="sm">
      {status === 'ok' ? 'OK' : 'Error'}
    </QTag>
  );
}

// ── Rollout strategy ──────────────────────────────────────────────────────────

const ROLLOUT_STRATEGY: Record<RolloutStrategy, { tone: QTagColor; label: string }> = {
  off: { tone: 'neutral', label: 'Off' },
  full: { tone: 'success', label: 'Full' },
  percentage: { tone: 'info', label: 'Percentage' },
  canary: { tone: 'warning', label: 'Canary' },
  environment: { tone: 'info', label: 'Environment' },
};

export function RolloutStrategyBadge({ strategy }: { strategy: RolloutStrategy }): ReactElement {
  const { tone, label } = ROLLOUT_STRATEGY[strategy];
  return (
    <QTag color={tone} size="sm">
      {label}
    </QTag>
  );
}

// ── Cost trend ────────────────────────────────────────────────────────────────

const COST_TREND: Record<CostTrend, { tone: QTagColor; label: string; icon: LucideIcon | null }> = {
  rising: { tone: 'warning', label: 'Rising', icon: ArrowUpRight },
  falling: { tone: 'success', label: 'Falling', icon: ArrowDownRight },
  stable: { tone: 'neutral', label: 'Stable', icon: Minus },
  unknown: { tone: 'neutral', label: 'Unknown', icon: null },
};

export function CostTrendBadge({ trend }: { trend: CostTrend }): ReactElement {
  const { tone, label, icon: Icon } = COST_TREND[trend];
  return (
    <QTag color={tone} size="md">
      <span className="inline-flex items-center gap-1">
        {Icon ? <Icon size={14} strokeWidth={1.75} aria-hidden /> : null}
        {label}
      </span>
    </QTag>
  );
}
