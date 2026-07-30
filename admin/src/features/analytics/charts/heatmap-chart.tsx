import { useMemo, type ReactElement } from 'react';

import { EChart, type EChartOption } from './echart';
import { useChartTheme } from './use-chart-theme';

interface HeatmapChartProps {
  /** `[date, value]` pairs (ISO `YYYY-MM-DD`). */
  data: Array<[string, number]>;
  height?: number;
  ariaLabel: string;
}

/**
 * Calendar heat map — daily intensity over the range (used for registrations).
 * A meaningful "where appropriate" heat map: per-day counts map cleanly onto a
 * calendar coordinate system.
 */
export function HeatmapChart({ data, height, ariaLabel }: HeatmapChartProps): ReactElement {
  const theme = useChartTheme();
  const option = useMemo<EChartOption>(() => {
    const dates = data.map(([date]) => date).sort();
    const from = dates[0] ?? new Date().toISOString().slice(0, 10);
    const to = dates[dates.length - 1] ?? from;
    const max = Math.max(1, ...data.map(([, value]) => value));
    return {
      tooltip: {
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        textStyle: { color: theme.text },
      },
      visualMap: {
        min: 0,
        max,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        inRange: { color: ['#dbeafe', theme.palette[0]] },
        textStyle: { color: theme.text },
      },
      calendar: {
        range: [from, to],
        cellSize: ['auto', 14],
        top: 24,
        left: 36,
        right: 12,
        itemStyle: { borderColor: theme.splitLine, color: 'transparent', borderWidth: 1 },
        dayLabel: { color: theme.text },
        monthLabel: { color: theme.text },
        yearLabel: { show: false },
        splitLine: { lineStyle: { color: theme.axis } },
      },
      series: [{ type: 'heatmap', coordinateSystem: 'calendar', data }],
    };
  }, [theme, data]);
  return <EChart option={option} height={height} ariaLabel={ariaLabel} />;
}
