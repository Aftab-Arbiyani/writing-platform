import { DatePicker, Segmented } from 'antd';
import type { ReactElement } from 'react';

import { useDashboardStore, type TimeRange } from '../stores/dashboard.store';

/**
 * Dashboard time-range control (docs: Filters). Writes only to the dashboard UI store (Selected Time
 * Range). Note: the currently-integrated read endpoints return all-time / current-state data, so this
 * control is forward-looking — it scopes time-aware widgets as they ship. Custom reveals a range picker.
 */
const OPTIONS: { value: TimeRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'custom', label: 'Custom' },
];

export function TimeRangeFilter(): ReactElement {
  const timeRange = useDashboardStore((state) => state.timeRange);
  const setTimeRange = useDashboardStore((state) => state.setTimeRange);
  const setCustomRange = useDashboardStore((state) => state.setCustomRange);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented<TimeRange>
        size="small"
        value={timeRange}
        onChange={setTimeRange}
        options={OPTIONS}
        aria-label="Dashboard time range"
      />
      {timeRange === 'custom' ? (
        <DatePicker.RangePicker
          size="small"
          onChange={(_dates, [from, to]) => setCustomRange(from || null, to || null)}
        />
      ) : null}
    </div>
  );
}
