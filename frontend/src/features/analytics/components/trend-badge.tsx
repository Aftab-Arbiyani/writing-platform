import { cn } from '@qalam/ui';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

import { formatCount } from '@/lib/format';

import type { Trend } from '../lib/derive-trends';

const TONE: Record<Trend['direction'], string> = {
  up: 'text-success',
  down: 'text-danger',
  flat: 'text-ink-muted',
};
const ICON = { up: TrendingUp, down: TrendingDown, flat: Minus } as const;

/** The human label for a trend: a % when we can divide, else the absolute change. */
function trendLabel(trend: Trend): string {
  const sign = trend.direction === 'up' ? '+' : trend.direction === 'down' ? '−' : '';
  if (trend.deltaPct !== null) {
    return `${sign}${String(Math.round(Math.abs(trend.deltaPct) * 100))}%`;
  }
  return `${sign}${formatCount(Math.abs(trend.delta))}`;
}

/**
 * A compact trend pill (docs/06 §3.10 deltas: "▲ 12%") — direction arrow + coloured change over the
 * selected range. Only rendered when a real trend exists (≥2 snapshot points); never a fabricated
 * delta. `srText` gives screen readers the full phrasing.
 */
export function TrendBadge({ trend, srText }: { trend: Trend; srText?: string }): ReactElement {
  const Icon = ICON[trend.direction];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
        TONE[trend.direction],
      )}
    >
      <Icon size={13} strokeWidth={2} aria-hidden />
      <span aria-hidden>{trendLabel(trend)}</span>
      <span className="sr-only">{srText ?? `${trendLabel(trend)} over the selected range`}</span>
    </span>
  );
}

/**
 * A larger, labelled growth indicator (docs: "Growth Indicator") — for a headline number like
 * "▲ 214 followers gained". Same tone system as `TrendBadge`.
 */
export function GrowthIndicator({
  direction,
  children,
}: {
  direction: Trend['direction'];
  children: ReactNode;
}): ReactElement {
  const Icon = ICON[direction];
  return (
    <span className={cn('inline-flex items-center gap-1 text-sm font-medium', TONE[direction])}>
      <Icon size={16} strokeWidth={2} aria-hidden />
      {children}
    </span>
  );
}
