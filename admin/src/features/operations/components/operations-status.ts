import type { HealthStatus } from '@/components/status-indicator';

import type { ComponentStatus } from '../types/operations.types';

/**
 * Pure status-mapping helpers for the Operations views (P7.4) — kept out of the badge component
 * module so that file only exports components (react-refresh friendly). These translate a component's
 * operational status onto the shared `StatusIndicator` vocabulary + a display label.
 */

const COMPONENT_LABEL: Record<ComponentStatus, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  down: 'Down',
  unknown: 'Unknown',
};

/** Map a component status onto the shared `StatusIndicator` vocabulary. */
export function componentStatusToHealth(status: ComponentStatus): HealthStatus {
  return status === 'healthy'
    ? 'healthy'
    : status === 'degraded'
      ? 'warning'
      : status === 'down'
        ? 'critical'
        : 'unknown';
}

/** A component status' display label. */
export function componentStatusLabel(status: ComponentStatus): string {
  return COMPONENT_LABEL[status];
}
