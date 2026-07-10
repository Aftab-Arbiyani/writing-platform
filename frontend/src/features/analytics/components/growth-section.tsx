import { QSelect, cn } from '@qalam/ui';
import { AreaChart, LineChart as LineIcon } from 'lucide-react';
import type { ReactElement } from 'react';

import { formatCount, formatDate } from '@/lib/format';

import { metricSeries } from '../lib/derive-trends';
import {
  GROWTH_METRICS,
  useAnalyticsStore,
  type ChartStyle,
  type GrowthMetricKey,
} from '../stores/analytics.store';
import type { GrowthSeries } from '../types/analytics.types';
import { AnalyticsCard } from './analytics-card';
import { AnalyticsError } from './analytics-states';
import { LineChart } from './charts/line-chart';
import { DateRangePicker } from './date-range-picker';

const METRIC_OPTIONS = GROWTH_METRICS.map((m) => ({ value: m.key, label: m.label }));

function StyleToggle({
  value,
  onChange,
}: {
  value: ChartStyle;
  onChange: (style: ChartStyle) => void;
}): ReactElement {
  return (
    <div
      role="group"
      aria-label="Chart style"
      className="border-line inline-flex rounded-md border p-0.5"
    >
      {(
        [
          { key: 'area', icon: AreaChart, label: 'Area' },
          { key: 'line', icon: LineIcon, label: 'Line' },
        ] as const
      ).map(({ key, icon: Icon, label }) => (
        <button
          key={key}
          type="button"
          aria-label={label}
          aria-pressed={value === key}
          onClick={() => {
            onChange(key);
          }}
          className={cn(
            'inline-flex size-7 items-center justify-center rounded',
            value === key ? 'bg-raised text-ink' : 'text-ink-muted hover:text-ink',
          )}
        >
          <Icon size={15} strokeWidth={1.75} aria-hidden />
        </button>
      ))}
    </div>
  );
}

/**
 * Performance-over-time (docs/06 §3.10 "views over time"). A metric selector + date-range preset +
 * area/line toggle drive the growth `LineChart`. Data comes from snapshots (admin-generated, no
 * cron in `v1`), so an empty series shows an honest chart-empty state, never faked points. "Updated
 * nightly" is stated honestly per the docs.
 */
export function GrowthSection({
  query,
}: {
  query: {
    data?: GrowthSeries;
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    refetch: () => void;
  };
}): ReactElement {
  const metric = useAnalyticsStore((s) => s.metric);
  const setMetric = useAnalyticsStore((s) => s.setMetric);
  const chartStyle = useAnalyticsStore((s) => s.chartStyle);
  const setChartStyle = useAnalyticsStore((s) => s.setChartStyle);

  const points = query.data?.points ?? [];
  const series = metricSeries(points, metric);
  const metricLabel = GROWTH_METRICS.find((m) => m.key === metric)?.label ?? metric;

  return (
    <AnalyticsCard
      title="Performance over time"
      description="Updated nightly."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <StyleToggle value={chartStyle} onChange={setChartStyle} />
          <QSelect
            aria-label="Metric"
            style={{ minWidth: 150 }}
            value={metric}
            onChange={(value) => {
              if (typeof value === 'string') setMetric(value as GrowthMetricKey);
            }}
            options={METRIC_OPTIONS}
          />
          <DateRangePicker />
        </div>
      }
    >
      {query.isError ? (
        <AnalyticsError error={query.error} onRetry={query.refetch} />
      ) : (
        <LineChart
          x={series.map(([d]) => formatDate(d))}
          values={series.map(([, v]) => v)}
          seriesName={metricLabel}
          ariaLabel={`${metricLabel} over time`}
          area={chartStyle === 'area'}
          loading={query.isLoading}
          valueFormatter={formatCount}
          height={280}
        />
      )}
    </AnalyticsCard>
  );
}
