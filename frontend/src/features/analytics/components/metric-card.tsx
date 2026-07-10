import { QCard, QSkeleton } from '@qalam/ui';
import { Tooltip } from 'antd';
import { Info } from 'lucide-react';
import { memo, type ReactElement } from 'react';

import type { Trend } from '../lib/derive-trends';
import { MiniTrendChart } from './charts/mini-trend-chart';
import { TrendBadge } from './trend-badge';

export interface MetricCardProps {
  label: string;
  /** Pre-formatted value (counts/percent/duration formatted by the caller). */
  value: string;
  /** Definition surfaced in a tooltip (docs/06 §3.10 — "writers must trust the numbers"). */
  hint?: string;
  trend?: Trend | null;
  /** Optional sparkline series (mini trend). */
  spark?: number[];
  loading?: boolean;
}

/**
 * A single metric tile (docs: "Metric Card" / "Statistic Tile"). Label (+ optional definition
 * tooltip), a prominent value, an optional trend badge and a decorative sparkline. No API logic —
 * the caller passes formatted values. `memo`d (the overview grid renders many). Skeleton while loading.
 */
export const MetricCard = memo(function MetricCard({
  label,
  value,
  hint,
  trend,
  spark,
  loading = false,
}: MetricCardProps): ReactElement {
  if (loading) {
    return (
      <QCard padding="md" className="flex flex-col gap-3">
        <QSkeleton variant="text" lines={1} width="60%" />
        <QSkeleton variant="title" width="45%" />
      </QCard>
    );
  }

  return (
    <QCard padding="md" className="flex flex-col gap-1">
      <div className="flex items-center gap-1 text-sm text-ink-secondary">
        <span>{label}</span>
        {hint ? (
          <Tooltip title={hint}>
            <button
              type="button"
              aria-label={`${label}: ${hint}`}
              className="inline-flex text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Info size={13} strokeWidth={1.75} aria-hidden />
            </button>
          </Tooltip>
        ) : null}
      </div>

      <div className="flex items-end justify-between gap-2">
        <span className="font-serif text-2xl font-semibold tabular-nums text-ink">{value}</span>
        {trend ? (
          <TrendBadge
            trend={trend}
            srText={`${label} ${trend.direction} over the selected range`}
          />
        ) : null}
      </div>

      {spark && spark.length >= 2 ? (
        <div className="mt-1.5">
          <MiniTrendChart values={spark} />
        </div>
      ) : null}
    </QCard>
  );
});
