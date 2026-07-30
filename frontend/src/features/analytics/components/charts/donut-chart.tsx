import { useMemo, type ReactElement } from 'react';

import { useThemeStore } from '@/stores/theme.store';

import { buildDonutOption, resolveChartTheme } from '../../lib/chart-options';
import { Chart } from './chart';

/** Donut (default) or pie chart — reading-source / distribution breakdowns. */
export function DonutChart({
  items,
  ariaLabel,
  height,
  loading,
  donut = true,
  valueFormatter,
}: {
  items: { name: string; value: number }[];
  ariaLabel: string;
  height?: number;
  loading?: boolean;
  donut?: boolean;
  valueFormatter?: (v: number) => string;
}): ReactElement {
  const resolved = useThemeStore((s) => s.resolved);

  const option = useMemo(
    () => buildDonutOption({ items, theme: resolveChartTheme(resolved), donut }),
    [items, donut, resolved],
  );

  const table = useMemo(
    () => ({
      caption: ariaLabel,
      columns: ['Segment', 'Value'],
      rows: items.map((it) => [it.name, valueFormatter ? valueFormatter(it.value) : it.value]),
    }),
    [items, ariaLabel, valueFormatter],
  );

  return (
    <Chart
      option={option}
      ariaLabel={ariaLabel}
      height={height}
      loading={loading}
      isEmpty={items.length === 0 || items.every((it) => it.value === 0)}
      emptyMessage="No traffic yet."
      table={table}
    />
  );
}
