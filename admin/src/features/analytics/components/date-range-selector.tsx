import { Select } from 'antd';
import type { ReactElement } from 'react';

import { RANGE_OPTIONS } from '../analytics.constants';
import type { TrendRange } from '../types/analytics.types';

interface DateRangeSelectorProps {
  range: TrendRange;
  from?: string;
  to?: string;
  onRange: (range: TrendRange) => void;
  onCustom: (from: string | undefined, to: string | undefined) => void;
}

const toDateInput = (iso: string | undefined): string =>
  iso !== undefined ? iso.slice(0, 10) : '';
const fromDateInput = (value: string): string | undefined =>
  value === '' ? undefined : new Date(value).toISOString();

/** Date-range presets + a custom from/to picker (A8). Controlled by the filter store. */
export function DateRangeSelector({
  range,
  from,
  to,
  onRange,
  onCustom,
}: DateRangeSelectorProps): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select<TrendRange>
        value={range}
        onChange={onRange}
        options={RANGE_OPTIONS}
        style={{ minWidth: 150 }}
        aria-label="Date range"
      />
      {range === 'custom' ? (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={toDateInput(from)}
            onChange={(event) => onCustom(fromDateInput(event.target.value), to)}
            className="rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink"
            aria-label="From date"
          />
          <span className="text-sm text-ink-muted">to</span>
          <input
            type="date"
            value={toDateInput(to)}
            onChange={(event) => onCustom(from, fromDateInput(event.target.value))}
            className="rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink"
            aria-label="To date"
          />
        </div>
      ) : null}
    </div>
  );
}
