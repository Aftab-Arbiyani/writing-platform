import type { ReactElement, ReactNode } from 'react';

import { cn } from '../lib/cn.js';

export interface QBadgeProps {
  /** The anchor (bell icon, tab item). */
  children: ReactNode;
  /** Count pill; omit + set `dot` for presence-only. */
  count?: number;
  dot?: boolean;
  /** Default 9 → "9+". */
  max?: number;
  /** REQUIRED — a dot/pill says nothing to a screen reader (docs/07 §7.6). */
  srLabel: string;
  className?: string;
}

/** Notification dot / count pill (docs/07 §7.6). Positioned logical top-end of its anchor. */
export function QBadge({
  children,
  count,
  dot = false,
  max = 9,
  srLabel,
  className,
}: QBadgeProps): ReactElement {
  const showCount = typeof count === 'number' && count > 0;
  const label = showCount ? (count > max ? `${String(max)}+` : String(count)) : null;

  return (
    <span className={cn('relative inline-flex', className)}>
      {children}
      {dot && !showCount ? (
        <span aria-hidden className="absolute -end-0.5 -top-0.5 size-2 rounded-full bg-accent" />
      ) : null}
      {showCount ? (
        <span
          aria-hidden
          className="absolute -end-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-medium text-white"
        >
          {label}
        </span>
      ) : null}
      <span className="sr-only">{srLabel}</span>
    </span>
  );
}
