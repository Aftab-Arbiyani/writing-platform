import { useMemo, type ReactElement } from 'react';

import { EChart, type EChartOption } from './echart';
import { useChartTheme } from './use-chart-theme';

export interface PieDatum {
  name: string;
  value: number;
}

interface PieChartProps {
  data: PieDatum[];
  donut?: boolean;
  height?: number;
  ariaLabel: string;
  showLegend?: boolean;
}

/** Pie (or donut) chart — categorical composition. */
export function PieChart({
  data,
  donut = false,
  height,
  ariaLabel,
  showLegend = true,
}: PieChartProps): ReactElement {
  const theme = useChartTheme();
  const option = useMemo<EChartOption>(
    () => ({
      color: theme.palette,
      textStyle: { color: theme.text, fontFamily: 'inherit' },
      tooltip: {
        trigger: 'item',
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        textStyle: { color: theme.text },
      },
      legend: showLegend
        ? { orient: 'horizontal', bottom: 0, textStyle: { color: theme.text } }
        : undefined,
      series: [
        {
          type: 'pie',
          radius: donut ? ['45%', '70%'] : '70%',
          center: ['50%', showLegend ? '45%' : '50%'],
          data,
          label: { color: theme.text },
          labelLine: { lineStyle: { color: theme.axis } },
          itemStyle: { borderColor: theme.tooltipBg, borderWidth: 2 },
        },
      ],
    }),
    [theme, data, donut, showLegend],
  );
  return <EChart option={option} height={height} ariaLabel={ariaLabel} />;
}

/** Donut chart — a pie with a hole. */
export function DonutChart(props: Omit<PieChartProps, 'donut'>): ReactElement {
  return <PieChart {...props} donut />;
}
