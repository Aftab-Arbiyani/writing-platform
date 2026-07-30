import { QCard, cn } from '@qalam/ui';
import type { ReactElement, ReactNode } from 'react';

/**
 * Presentational titled surface — the base shell for dashboard sections. Renders an optional header
 * (heading + trailing action slot) and a body. State handling (loading/error/empty/collapse) lives in
 * `WidgetContainer`, which composes this. Kept generic + reusable for future admin modules.
 */
export interface DashboardCardProps {
  title?: ReactNode;
  action?: ReactNode;
  /** Heading level for the title (default h3). */
  headingLevel?: 2 | 3;
  children: ReactNode;
  bodyClassName?: string;
  className?: string;
}

export function DashboardCard({
  title,
  action,
  headingLevel = 3,
  children,
  bodyClassName,
  className,
}: DashboardCardProps): ReactElement {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <QCard as="section" padding="none" className={cn('flex flex-col', className)}>
      {title || action ? (
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          {title ? <Heading className="text-sm font-semibold text-ink">{title}</Heading> : <span />}
          {action}
        </div>
      ) : null}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </QCard>
  );
}
