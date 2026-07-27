/**
 * ECharts option builders — pure functions that return plain option objects (this module never
 * imports echarts, so it adds nothing to the bundle and the chart engine stays lazy-loaded). The
 * `Chart` wrapper feeds these to `setOption`. Colours come from the live `--q-*` design tokens
 * (`resolveChartTheme` reads the active theme off `<html>`), so charts match light/dark + the brand
 * with no hard-coded hex in components.
 */

/** A plain ECharts option; typed loosely so this stays echarts-free (the wrapper owns the types). */
export type ChartOption = Record<string, unknown>;

export interface ChartTheme {
  text: string;
  textSecondary: string;
  textMuted: string;
  line: string;
  accent: string;
  surface: string;
  /** Categorical palette for pie/donut slices. */
  palette: string[];
}

/** Per-theme hex fallbacks (used when CSS vars can't be read, e.g. jsdom) — mirror `tokens.css`. */
const FALLBACKS: Record<'light' | 'dark', ChartTheme> = {
  light: {
    text: '#24211b',
    textSecondary: '#6b655a',
    textMuted: '#726c61',
    line: '#e7e1d6',
    accent: '#9e4b28',
    surface: '#ffffff',
    palette: ['#9e4b28', '#3b6ea8', '#3e7c4f', '#8d651a', '#b3382e', '#726c61'],
  },
  dark: {
    text: '#ece6da',
    textSecondary: '#a69f90',
    textMuted: '#8f897f',
    line: '#2e2a24',
    accent: '#d07349',
    surface: '#1c1917',
    palette: ['#d07349', '#7ca6d6', '#6baa7c', '#c99a4c', '#d06a5f', '#8f897f'],
  },
};

function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * Read the active theme's chart palette from the `--q-*` tokens on `<html>`. `resolved` picks the
 * fallback set (so charts still theme-match when CSS vars are unreadable) and makes the calling
 * memo's theme dependency genuine.
 */
export function resolveChartTheme(resolved: 'light' | 'dark'): ChartTheme {
  const fb = FALLBACKS[resolved];
  const accent = cssVar('--q-accent', fb.accent);
  return {
    text: cssVar('--q-text-primary', fb.text),
    textSecondary: cssVar('--q-text-secondary', fb.textSecondary),
    textMuted: cssVar('--q-text-muted', fb.textMuted),
    line: cssVar('--q-border', fb.line),
    accent,
    surface: cssVar('--q-bg-surface', fb.surface),
    palette: [
      accent,
      cssVar('--q-info', fb.palette[1] ?? '#3b6ea8'),
      cssVar('--q-success', fb.palette[2] ?? '#3e7c4f'),
      cssVar('--q-warning', fb.palette[3] ?? '#8d651a'),
      cssVar('--q-danger', fb.palette[4] ?? '#b3382e'),
      cssVar('--q-text-muted', fb.textMuted),
    ],
  };
}

/** `#rrggbb` → `rgba(r,g,b,a)`; passes other formats through untouched. */
function withAlpha(hex: string, alpha: number): string {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  if (!match) return hex;
  const r = parseInt(match[1] ?? '0', 16);
  const g = parseInt(match[2] ?? '0', 16);
  const b = parseInt(match[3] ?? '0', 16);
  return `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(alpha)})`;
}

const axisLabel = (theme: ChartTheme) => ({ color: theme.textMuted, fontSize: 11 });
const tooltipBox = (theme: ChartTheme) => ({
  backgroundColor: theme.surface,
  borderColor: theme.line,
  borderWidth: 1,
  textStyle: { color: theme.text, fontSize: 12 },
});

/** A line / area chart over a category (date) x-axis. */
export function buildLineOption(opts: {
  x: string[];
  values: number[];
  name: string;
  theme: ChartTheme;
  area?: boolean;
}): ChartOption {
  const { x, values, name, theme, area = true } = opts;
  return {
    grid: { left: 6, right: 14, top: 14, bottom: 6, containLabel: true },
    tooltip: { trigger: 'axis', ...tooltipBox(theme) },
    xAxis: {
      type: 'category',
      data: x,
      boundaryGap: false,
      axisLine: { lineStyle: { color: theme.line } },
      axisTick: { show: false },
      axisLabel: axisLabel(theme),
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: theme.line, type: 'dashed' } },
      axisLabel: axisLabel(theme),
    },
    series: [
      {
        name,
        type: 'line',
        data: values,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: theme.accent, width: 2 },
        itemStyle: { color: theme.accent },
        areaStyle: area ? { color: withAlpha(theme.accent, 0.1) } : undefined,
      },
    ],
  };
}

/** A horizontal bar chart (labels read left-to-right; good for engagement breakdowns). */
export function buildBarOption(opts: {
  categories: string[];
  values: number[];
  theme: ChartTheme;
}): ChartOption {
  const { categories, values, theme } = opts;
  return {
    grid: { left: 6, right: 24, top: 8, bottom: 6, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, ...tooltipBox(theme) },
    xAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: theme.line, type: 'dashed' } },
      axisLabel: axisLabel(theme),
    },
    yAxis: {
      type: 'category',
      data: categories,
      inverse: true,
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: theme.textSecondary, fontSize: 12 },
    },
    series: [
      {
        type: 'bar',
        data: values,
        barWidth: '56%',
        itemStyle: { color: theme.accent, borderRadius: [0, 4, 4, 0] },
      },
    ],
  };
}

/** A donut (or full pie) chart. */
export function buildDonutOption(opts: {
  items: { name: string; value: number }[];
  theme: ChartTheme;
  donut?: boolean;
}): ChartOption {
  const { items, theme, donut = true } = opts;
  return {
    tooltip: { trigger: 'item', ...tooltipBox(theme) },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: theme.textSecondary, fontSize: 12 },
    },
    color: theme.palette,
    series: [
      {
        type: 'pie',
        radius: donut ? ['52%', '74%'] : '68%',
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: { borderColor: theme.surface, borderWidth: 2 },
        data: items,
      },
    ],
  };
}

/** A minimal sparkline (mini trend) — no axes, no tooltip. */
export function buildSparklineOption(opts: { values: number[]; theme: ChartTheme }): ChartOption {
  const { values, theme } = opts;
  return {
    grid: { left: 1, right: 1, top: 2, bottom: 2 },
    xAxis: { type: 'category', show: false, boundaryGap: false, data: values.map((_, i) => i) },
    yAxis: { type: 'value', show: false, scale: true },
    tooltip: { show: false },
    series: [
      {
        type: 'line',
        data: values,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: theme.accent, width: 1.5 },
        areaStyle: { color: withAlpha(theme.accent, 0.12) },
      },
    ],
  };
}
