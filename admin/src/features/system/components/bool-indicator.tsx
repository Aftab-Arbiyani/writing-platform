import type { ReactElement } from 'react';

import { StatusIndicator, type HealthStatus } from '@/components/status-indicator';

/**
 * Renders a boolean flag (enabled / present / valid / placeholder) as a `StatusIndicator` — a
 * colored dot plus an accessible word, never color alone. The caller picks the label and tone for
 * each side so the same primitive reads correctly whether `true` is the good state (e.g. "Valid")
 * or the bad one (e.g. "Placeholder"). Used across the System views for every yes/no field.
 */
export interface BoolIndicatorProps {
  value: boolean;
  trueLabel?: string;
  falseLabel?: string;
  trueStatus?: HealthStatus;
  falseStatus?: HealthStatus;
}

export function BoolIndicator({
  value,
  trueLabel = 'Yes',
  falseLabel = 'No',
  trueStatus = 'healthy',
  falseStatus = 'unknown',
}: BoolIndicatorProps): ReactElement {
  return (
    <StatusIndicator
      status={value ? trueStatus : falseStatus}
      label={value ? trueLabel : falseLabel}
    />
  );
}
