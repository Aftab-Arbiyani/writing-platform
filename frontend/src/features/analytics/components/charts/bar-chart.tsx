import { useMemo, type ReactElement } from 'react';

import { useThemeStore } from '@/stores/theme.store';

import { buildBarOption, resolveChartTheme } from '../../lib/chart-options';
import { Chart } from './chart';

/** Horizontal bar chart (engagement breakdowns). Categories read left-to-right. */
export function BarChart({
  categories,
  values,
  ariaLabel,
  height,
  loading,
  valueFormatter,
}: {
  categories: string[];
  values: number[];
  ariaLabel: string;
  height?: number;
  loading?: boolean;
  valueFormatter?: (v: number) => string;
}): ReactElement {
  const resolved = useThemeStore((s) => s.resolved);

  const option = useMemo(
    () => buildBarOption({ categories, values, theme: resolveChartTheme(resolved) }),
    [categories, values, resolved],
  );

  const table = useMemo(
    () => ({
      caption: ariaLabel,
      columns: ['Metric', 'Value'],
      rows: categories.map((label, i) => [
        label,
        valueFormatter ? valueFormatter(values[i] ?? 0) : (values[i] ?? 0),
      ]),
    }),
    [categories, values, ariaLabel, valueFormatter],
  );

  return (
    <Chart
      option={option}
      ariaLabel={ariaLabel}
      height={height}
      loading={loading}
      isEmpty={categories.length === 0 || values.every((v) => v === 0)}
      table={table}
    />
  );
}
