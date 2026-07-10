import { QCard } from '@qalam/ui';
import type { LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';

import { StatusIndicator, type HealthStatus } from '@/components/status-indicator';

/**
 * A single system-health tile: service name + a colored status + optional detail line. Status is
 * conveyed by both color and text (never color-only). Reusable across admin monitoring surfaces.
 */
export interface HealthStatusCardProps {
  name: string;
  status: HealthStatus;
  detail?: string;
  icon?: LucideIcon;
}

export function HealthStatusCard({
  name,
  status,
  detail,
  icon: Icon,
}: HealthStatusCardProps): ReactElement {
  return (
    <QCard padding="md" className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {Icon ? (
          <Icon size={16} strokeWidth={1.75} className="text-ink-secondary" aria-hidden />
        ) : null}
        <span className="text-sm font-medium text-ink">{name}</span>
      </div>
      <StatusIndicator status={status} />
      {detail ? <span className="text-xs text-ink-muted">{detail}</span> : null}
    </QCard>
  );
}
