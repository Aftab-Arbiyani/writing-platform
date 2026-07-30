import { QSelect } from '@qalam/ui';
import type { ReactElement } from 'react';

import { RANGE_WINDOWS, useAnalyticsStore, type RangePreset } from '../stores/analytics.store';

const OPTIONS = (Object.keys(RANGE_WINDOWS) as RangePreset[]).map((value) => ({
  value,
  label: RANGE_WINDOWS[value].label,
}));

/**
 * The growth "date range" selector (docs/06 §3.10 "[Last 7 days ▾]", the prompt's Date Range
 * filter). Backed by Zustand (a view PREFERENCE, persisted) — it resolves to the API's
 * `period` + `points` window. The writer aggregate is all-time + un-filterable, so this only
 * scopes the growth series (an honest limitation of the v1 aggregates, not a fake filter).
 */
export function DateRangePicker(): ReactElement {
  const range = useAnalyticsStore((s) => s.range);
  const setRange = useAnalyticsStore((s) => s.setRange);

  return (
    <QSelect
      aria-label="Date range"
      style={{ minWidth: 168 }}
      value={range}
      onChange={(value) => {
        if (typeof value === 'string') setRange(value as RangePreset);
      }}
      options={OPTIONS}
    />
  );
}
