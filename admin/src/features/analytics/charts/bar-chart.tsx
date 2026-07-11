import { useMemo, type ReactElement } from 'react';

import { axisFor, cartesianBase } from './chart-options';
import { EChart, type EChartOption } from './echart';
import { useChartTheme } from './use-chart-theme';

interface BarChartProps {
  categories: string[];
  data: number[];
  horizontal?: boolean;
  height?: number;
  ariaLabel: string;
}

/** Bar chart — vertical by default; `horizontal` for ranked lists (top-N). */
export function BarChart({
  categories,
  data,
  horizontal = false,
  height,
  ariaLabel,
}: BarChartProps): ReactElement {
  const theme = useChartTheme();
  const option = useMemo<EChartOption>(() => {
    const base = cartesianBase(theme, false);
    const axes = axisFor(theme, categories);
    return {
      ...base,
      // Swap axes for a horizontal bar (category on Y).
      xAxis: horizontal ? axes.yAxis : axes.xAxis,
      yAxis: horizontal
        ? {
            type: 'category',
            data: categories,
            axisLine: { lineStyle: { color: theme.axis } },
            axisLabel: { color: theme.text },
          }
        : axes.yAxis,
      series: [
        {
          type: 'bar',
          data,
          itemStyle: {
            color: theme.palette[0],
            borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
          },
          barMaxWidth: 28,
        },
      ],
    };
  }, [theme, categories, data, horizontal]);
  return <EChart option={option} height={height} ariaLabel={ariaLabel} />;
}
