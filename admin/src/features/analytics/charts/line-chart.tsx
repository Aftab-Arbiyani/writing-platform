import { useMemo, type ReactElement } from 'react';

import { axisFor, cartesianBase } from './chart-options';
import { EChart, type EChartOption } from './echart';
import { useChartTheme } from './use-chart-theme';

export interface ChartSeries {
  name: string;
  data: number[];
}

interface LineChartProps {
  categories: string[];
  series: ChartSeries[];
  area?: boolean;
  height?: number;
  ariaLabel: string;
  showLegend?: boolean;
}

/** Line (or area) chart — one or more series over categories. */
export function LineChart({
  categories,
  series,
  area = false,
  height,
  ariaLabel,
  showLegend = false,
}: LineChartProps): ReactElement {
  const theme = useChartTheme();
  const option = useMemo<EChartOption>(
    () => ({
      ...cartesianBase(theme, showLegend && series.length > 1),
      ...axisFor(theme, categories),
      series: series.map((s) => ({
        name: s.name,
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: s.data,
        areaStyle: area ? { opacity: 0.15 } : undefined,
        lineStyle: { width: 2 },
      })),
    }),
    [theme, categories, series, area, showLegend],
  );
  return <EChart option={option} height={height} ariaLabel={ariaLabel} />;
}

/** Area chart — a filled line chart. */
export function AreaChart(props: Omit<LineChartProps, 'area'>): ReactElement {
  return <LineChart {...props} area />;
}
