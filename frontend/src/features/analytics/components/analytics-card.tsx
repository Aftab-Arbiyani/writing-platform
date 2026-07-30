import { QCard, cn } from '@qalam/ui';
import type { ReactElement, ReactNode } from 'react';

/**
 * A dashboard section card (docs: "Analytics Card" / "Chart Container") — a titled surface with an
 * optional description + header action slot, wrapping charts/tables. Presentational only; the
 * caller passes loading/empty children. `as="section"` + an `<h2>` give it a landmark heading.
 */
export function AnalyticsCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <QCard as="section" padding="lg" className={cn('flex flex-col gap-4', className)}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-serif text-lg font-semibold text-ink">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-ink-secondary">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      {children}
    </QCard>
  );
}
