import { cn } from '@qalam/ui';
import { AlertTriangle, Info, XCircle } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

import { formatDateTime } from '@/lib/format';

/**
 * A list of system alerts, each with a severity icon + tone. Presentational — the data source
 * derives `AlertItem[]` (e.g. from failed-job counts or system notices). Reusable for any admin
 * alert surface. Severity is conveyed by icon + text, not color alone.
 */
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AlertItem {
  id: string;
  severity: AlertSeverity;
  title: ReactNode;
  description?: ReactNode;
  timestamp?: string;
}

const SEVERITY = {
  info: { icon: Info, tone: 'text-info' },
  warning: { icon: AlertTriangle, tone: 'text-warning' },
  critical: { icon: XCircle, tone: 'text-danger' },
} as const;

export interface AlertPanelProps {
  alerts: AlertItem[];
}

export function AlertPanel({ alerts }: AlertPanelProps): ReactElement {
  return (
    <ul className="flex flex-col divide-y divide-line">
      {alerts.map((alert) => {
        const { icon: Icon, tone } = SEVERITY[alert.severity];
        return (
          <li key={alert.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
            <Icon
              size={18}
              strokeWidth={1.75}
              className={cn('mt-0.5 flex-shrink-0', tone)}
              aria-hidden
            />
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-medium text-ink">
                <span className="sr-only">{alert.severity}: </span>
                {alert.title}
              </span>
              {alert.description ? (
                <span className="text-xs text-ink-secondary">{alert.description}</span>
              ) : null}
              {alert.timestamp ? (
                <time dateTime={alert.timestamp} className="mt-0.5 text-xs text-ink-muted">
                  {formatDateTime(alert.timestamp)}
                </time>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
