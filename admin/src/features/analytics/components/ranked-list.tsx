import type { ReactElement } from 'react';

import { formatCount } from '@/lib/format';

import type { RankedItem } from '../types/analytics.types';

interface RankedListProps {
  items: RankedItem[];
  valueLabel?: string;
  emptyText?: string;
  /** Optional custom value formatter (defaults to a count). */
  formatValue?: (value: number) => string;
}

/**
 * An accessible ranked table (A8) — top languages/genres/writers/tags/etc. A real
 * `<table>` (not divs) so screen readers announce rank/label/value; empty renders
 * an honest note (used for the geo/device lists the backend can't populate).
 */
export function RankedList({
  items,
  valueLabel = 'Count',
  emptyText = 'No data.',
  formatValue = formatCount,
}: RankedListProps): ReactElement {
  if (items.length === 0) {
    return <p className="py-2 text-sm text-ink-muted">{emptyText}</p>;
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-start text-xs uppercase tracking-wide text-ink-muted">
          <th scope="col" className="w-8 py-1.5 text-start font-medium">
            #
          </th>
          <th scope="col" className="py-1.5 text-start font-medium">
            Name
          </th>
          <th scope="col" className="py-1.5 text-end font-medium">
            {valueLabel}
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, index) => (
          <tr key={item.key} className="border-b border-line last:border-0">
            <td className="py-1.5 tabular-nums text-ink-muted">{index + 1}</td>
            <td className="py-1.5 text-ink">{item.label}</td>
            <td className="py-1.5 text-end tabular-nums text-ink-secondary">
              {formatValue(item.count)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
