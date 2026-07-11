import { QCard } from '@qalam/ui';
import type { ReactElement, ReactNode } from 'react';

interface Metric {
  label: string;
  value: ReactNode;
}

interface ComparisonCardProps {
  title: string;
  primary: Metric;
  secondary: Metric;
}

/**
 * Two related metrics side by side (A8) — e.g. open vs closed reports, verified
 * vs total users. Token-styled; both themes handled by `QCard`.
 */
export function ComparisonCard({ title, primary, secondary }: ComparisonCardProps): ReactElement {
  return (
    <QCard padding="md" className="flex flex-col gap-3">
      <span className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
        {title}
      </span>
      <div className="flex items-end justify-between gap-4">
        {[primary, secondary].map((metric, index) => (
          <div key={index} className="flex flex-col gap-0.5">
            <span className="text-xl font-semibold text-ink [font-variant-numeric:tabular-nums]">
              {metric.value}
            </span>
            <span className="text-xs text-ink-muted">{metric.label}</span>
          </div>
        ))}
      </div>
    </QCard>
  );
}
