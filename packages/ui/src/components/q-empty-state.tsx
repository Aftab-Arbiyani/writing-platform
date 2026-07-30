import type { LucideIcon } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

import { cn } from '../lib/cn.js';

export interface QEmptyStateProps {
  icon?: LucideIcon;
  /** Literary voice — copy catalogue in docs/06 §4.4. */
  title: string;
  description?: string;
  /** At most one action by convention. */
  action?: ReactNode;
  minHeight?: number;
  className?: string;
}

/** Empty state (docs/07 §7.7). Icon in a raised circle, title, body ≤40ch, one action. */
export function QEmptyState({
  icon: Icon,
  title,
  description,
  action,
  minHeight = 320,
  className,
}: QEmptyStateProps): ReactElement {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3 px-6 text-center', className)}
      style={{ minHeight }}
    >
      {Icon ? (
        <span className="flex size-12 items-center justify-center rounded-full bg-raised">
          <Icon size={24} strokeWidth={1.5} className="text-ink-muted" aria-hidden />
        </span>
      ) : null}
      <h3 className="text-lg font-medium text-ink">{title}</h3>
      {description ? (
        <p className="max-w-[40ch] text-sm text-ink-secondary">{description}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
