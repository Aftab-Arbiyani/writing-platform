import { QCard, cn } from '@qalam/ui';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

/**
 * KPI card — a headline metric with an optional period-over-period delta indicator. Distinct from
 * `StatCard` (a plain tile): this surfaces movement (up = good by default; pass `invert` when down
 * is good, e.g. report backlog). Tone comes from tokens; both themes handled by `QCard`.
 */
export type TrendDirection = 'up' | 'down' | 'flat';

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  /** e.g. "+12%" or "-3". Rendered beside a direction icon. */
  delta?: string;
  direction?: TrendDirection;
  /** When true, a downward trend is styled positive (and vice-versa). */
  invert?: boolean;
  description?: string;
}

const ICON: Record<TrendDirection, typeof TrendingUp> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
};

function toneFor(direction: TrendDirection, invert: boolean): string {
  if (direction === 'flat') return 'text-ink-muted';
  const positive = invert ? direction === 'down' : direction === 'up';
  return positive ? 'text-success' : 'text-danger';
}

export function MetricCard({
  label,
  value,
  delta,
  direction = 'flat',
  invert = false,
  description,
}: MetricCardProps): ReactElement {
  const Icon = ICON[direction];
  return (
    <QCard padding="md" className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
        {label}
      </span>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-ink [font-variant-numeric:tabular-nums]">
          {value}
        </span>
        {delta ? (
          <span
            className={cn(
              'flex items-center gap-0.5 text-sm font-medium',
              toneFor(direction, invert),
            )}
          >
            <Icon size={15} strokeWidth={2} aria-hidden />
            {delta}
          </span>
        ) : null}
      </div>
      {description ? <span className="text-xs text-ink-muted">{description}</span> : null}
    </QCard>
  );
}
