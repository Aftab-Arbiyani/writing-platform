import type { LucideIcon } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

interface AnalyticsCardProps {
  title: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A titled surface for grouping metrics or lists on the dashboard (A8). */
export function AnalyticsCard({
  title,
  icon: Icon,
  actions,
  children,
  className,
}: AnalyticsCardProps): ReactElement {
  return (
    <section
      className={`flex flex-col rounded-lg border border-line bg-surface ${className ?? ''}`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          {Icon !== undefined ? (
            <span className="text-ink-secondary" aria-hidden="true">
              <Icon size={16} />
            </span>
          ) : null}
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
        </div>
        {actions !== undefined ? <div className="shrink-0">{actions}</div> : null}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
