import { cn } from '@qalam/ui';
import { Circle, type LucideIcon } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

import { formatDateTime } from '@/lib/format';

/**
 * A vertical, accessible activity feed (ordered list). Each entry has an icon marker, a title, an
 * optional description, and an optional timestamp rendered as a `<time>`. Presentational — the data
 * source maps its rows onto `ActivityItem[]`. Reusable for any admin timeline.
 */
export interface ActivityItem {
  id: string;
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  timestamp?: string;
}

export interface ActivityTimelineProps {
  items: ActivityItem[];
}

export function ActivityTimeline({ items }: ActivityTimelineProps): ReactElement {
  return (
    <ol className="flex flex-col gap-4">
      {items.map((item) => {
        const Icon = item.icon ?? Circle;
        return (
          <li key={item.id} className="flex gap-3">
            <span
              className={cn(
                'mt-0.5 flex size-7 flex-shrink-0 items-center justify-center rounded-full bg-raised',
              )}
              aria-hidden
            >
              <Icon size={14} strokeWidth={1.75} className="text-ink-secondary" />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-sm text-ink">{item.title}</span>
              {item.description ? (
                <span className="text-xs text-ink-secondary">{item.description}</span>
              ) : null}
              {item.timestamp ? (
                <time dateTime={item.timestamp} className="mt-0.5 text-xs text-ink-muted">
                  {formatDateTime(item.timestamp)}
                </time>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
