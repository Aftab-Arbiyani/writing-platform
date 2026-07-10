import { QTag, type QTagColor } from '@qalam/ui';
import type { ReactElement, ReactNode } from 'react';

/**
 * Small count/label pill for dashboard cards (e.g. "12 pending"). Wraps the shared `QTag` so tone +
 * tokens + dark mode are handled in one place. Reusable across admin modules.
 */
export interface MetricBadgeProps {
  children: ReactNode;
  tone?: QTagColor;
}

export function MetricBadge({ children, tone = 'neutral' }: MetricBadgeProps): ReactElement {
  return (
    <QTag color={tone} size="sm">
      {children}
    </QTag>
  );
}
