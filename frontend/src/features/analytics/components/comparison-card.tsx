import { QCard } from '@qalam/ui';
import type { ReactElement } from 'react';

import { formatCount } from '@/lib/format';

/**
 * A two-value comparison (docs: "Comparison Card") — e.g. unique vs. repeat views. Renders the two
 * labelled counts and a proportional split bar. Used instead of "new vs. returning readers", which
 * the `v1` aggregates don't track (never fabricated); unique-vs-repeat is honestly derivable from
 * `totalViews − uniqueViews`.
 */
export function ComparisonCard({
  title,
  primary,
  secondary,
}: {
  title: string;
  primary: { label: string; value: number };
  secondary: { label: string; value: number };
}): ReactElement {
  const total = primary.value + secondary.value;
  const primaryPct = total > 0 ? Math.round((primary.value / total) * 100) : 0;

  return (
    <QCard padding="md" className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-ink-secondary">{title}</h3>

      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-serif text-xl font-semibold tabular-nums text-ink">
            {formatCount(primary.value)}
          </p>
          <p className="text-xs text-ink-muted">{primary.label}</p>
        </div>
        <div className="text-end">
          <p className="font-serif text-xl font-semibold tabular-nums text-ink-secondary">
            {formatCount(secondary.value)}
          </p>
          <p className="text-xs text-ink-muted">{secondary.label}</p>
        </div>
      </div>

      <div
        className="flex h-2 overflow-hidden rounded-full bg-raised"
        role="img"
        aria-label={`${primary.label}: ${formatCount(primary.value)} (${String(primaryPct)}%), ${secondary.label}: ${formatCount(secondary.value)}`}
      >
        <span className="bg-accent" style={{ width: `${String(primaryPct)}%` }} />
      </div>
    </QCard>
  );
}
