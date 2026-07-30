import { cn } from '@qalam/ui';
import type { ReactElement, ReactNode } from 'react';

/**
 * Responsive auto-fill grid for stat/health/quick-action cards. Cards flow into as many columns as
 * fit at `minColWidth`, collapsing to one column on mobile (the `min(100%, …)` guards against
 * overflow below the min width). Desktop-first, tablet + mobile handled by the auto-fill.
 */
export interface DashboardGridProps {
  children: ReactNode;
  /** Minimum card width before wrapping to fewer columns (px). */
  minColWidth?: number;
  className?: string;
}

export function DashboardGrid({
  children,
  minColWidth = 220,
  className,
}: DashboardGridProps): ReactElement {
  return (
    <div
      className={cn('grid gap-4', className)}
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${minColWidth}px), 1fr))` }}
    >
      {children}
    </div>
  );
}
