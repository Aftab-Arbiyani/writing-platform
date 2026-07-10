import { useMemo, type ReactElement } from 'react';

import { useThemeStore } from '@/stores/theme.store';

import { buildLineOption, resolveChartTheme } from '../../lib/chart-options';
import { Chart } from './chart';

/**
 * Line / area chart over a date x-axis (docs/06 §3.10 "views over time"). Rebuilds its option when
 * the data OR the theme changes (so light/dark stays in sync); the option is memoized so a parent
 * re-render doesn't churn the chart. The a11y table mirrors the plotted series.
 */
export function LineChart({
  x,
  values,
  seriesName,
  ariaLabel,
  height,
  loading,
  area = true,
  valueFormatter,
}: {
  x: string[];
  values: number[];
  seriesName: string;
  ariaLabel: string;
  height?: number;
  loading?: boolean;
  area?: boolean;
  valueFormatter?: (v: number) => string;
}): ReactElement {
  const resolved = useThemeStore((s) => s.resolved);

  const option = useMemo(
    () =>
      buildLineOption({ x, values, name: seriesName, theme: resolveChartTheme(resolved), area }),
    // `resolved` is a dep so the option (which reads the live theme tokens) rebuilds on theme flip.
    [x, values, seriesName, area, resolved],
  );

  const table = useMemo(
    () => ({
      caption: ariaLabel,
      columns: ['Date', seriesName],
      rows: x.map((label, i) => [
        label,
        valueFormatter ? valueFormatter(values[i] ?? 0) : (values[i] ?? 0),
      ]),
    }),
    [x, values, seriesName, ariaLabel, valueFormatter],
  );

  return (
    <Chart
      option={option}
      ariaLabel={ariaLabel}
      height={height}
      loading={loading}
      isEmpty={values.length === 0}
      emptyMessage="Growth data appears as daily snapshots accumulate."
      table={table}
    />
  );
}
