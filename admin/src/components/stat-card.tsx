import { QCard } from '@qalam/ui';
import type { LucideIcon } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

/**
 * Compact stat tile for admin overviews — a label, a large value, and an optional leading icon.
 * Value is pre-formatted by the caller (use `lib/format`). Numeric-heavy, so the value uses
 * tabular figures. Built on the shared `QCard` (surface + border + dark-mode handled there).
 */
export interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  hint?: string;
}

export function StatCard({ label, value, icon: Icon, hint }: StatCardProps): ReactElement {
  return (
    <QCard padding="md" className="flex items-start gap-3">
      {Icon ? (
        <span className="flex size-10 flex-shrink-0 items-center justify-center rounded-md bg-raised">
          <Icon size={20} strokeWidth={1.75} className="text-accent" aria-hidden />
        </span>
      ) : null}
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
          {label}
        </span>
        <span className="text-2xl font-semibold text-ink [font-variant-numeric:tabular-nums]">
          {value}
        </span>
        {hint ? <span className="text-xs text-ink-muted">{hint}</span> : null}
      </div>
    </QCard>
  );
}
