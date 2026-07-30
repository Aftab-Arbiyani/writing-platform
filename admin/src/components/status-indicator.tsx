import { cn } from '@qalam/ui';
import type { ReactElement } from 'react';

/**
 * A colored dot + accessible label for system-health status. Tokens only; the dot is decorative
 * (aria-hidden) and the status word carries the meaning for screen readers (never color-only).
 */
export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

const TONE: Record<HealthStatus, string> = {
  healthy: 'bg-success',
  warning: 'bg-warning',
  critical: 'bg-danger',
  unknown: 'bg-ink-muted',
};

const DEFAULT_LABEL: Record<HealthStatus, string> = {
  healthy: 'Healthy',
  warning: 'Warning',
  critical: 'Critical',
  unknown: 'Unknown',
};

export interface StatusIndicatorProps {
  status: HealthStatus;
  label?: string;
  /** Show the label text beside the dot (default true). When false the label is SR-only. */
  showLabel?: boolean;
}

export function StatusIndicator({
  status,
  label,
  showLabel = true,
}: StatusIndicatorProps): ReactElement {
  const text = label ?? DEFAULT_LABEL[status];
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn('inline-block size-2.5 rounded-full', TONE[status])} aria-hidden />
      <span className={showLabel ? 'text-sm text-ink-secondary' : 'sr-only'}>{text}</span>
    </span>
  );
}
