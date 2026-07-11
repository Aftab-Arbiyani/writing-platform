import type { EChartOption } from './echart';
import type { ChartTheme } from './use-chart-theme';

/** Shared axis/grid/tooltip config for cartesian (line/bar) charts. */
export function cartesianBase(theme: ChartTheme, showLegend: boolean): EChartOption {
  return {
    color: theme.palette,
    grid: { left: 8, right: 16, top: showLegend ? 36 : 16, bottom: 8, containLabel: true },
    legend: showLegend ? { top: 0, textStyle: { color: theme.text } } : undefined,
    tooltip: {
      trigger: 'axis',
      backgroundColor: theme.tooltipBg,
      borderColor: theme.tooltipBorder,
      textStyle: { color: theme.text },
    },
    textStyle: { color: theme.text, fontFamily: 'inherit' },
  };
}

/** A category x-axis + value y-axis pair themed for the current mode. */
export function axisFor(
  theme: ChartTheme,
  categories: string[],
): Pick<EChartOption, 'xAxis' | 'yAxis'> {
  return {
    xAxis: {
      type: 'category',
      data: categories,
      axisLine: { lineStyle: { color: theme.axis } },
      axisLabel: { color: theme.text },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: theme.splitLine } },
      axisLabel: { color: theme.text },
    },
  };
}
