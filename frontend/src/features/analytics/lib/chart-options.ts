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

/**
 * Every token this module falls back to, keyed by the `--q-*` variable it mirrors, with **one copy
 * of each hex** (T-5, docs/48 §3.5).
 *
 * It used to hold a `palette` array as well, which re-listed five of these by index — and those
 * copies went stale the moment `--q-success` was darkened for W3c-2, leaving `#3e7c4f` in two places
 * here plus an inline `?? '#3e7c4f'` below. Harmless in effect (chart series are non-text graphics at
 * a 3:1 threshold, and the fallbacks only paint when the CSS variables cannot be read at all) but
 * they were undeclared copies of a single source of truth, which is the condition that produced
 * W3c-4. The palette is now DERIVED from this map, so a colour cannot be updated in one of two
 * places, and `chart-options.spec.ts` pins every entry against `tokens.css` itself.
 */
const FALLBACK_TOKENS = {
  light: {
    '--q-text-primary': '#24211b',
    '--q-text-secondary': '#6b655a',
    '--q-text-muted': '#726c61',
    '--q-border': '#e7e1d6',
    '--q-accent': '#9e4b28',
    '--q-bg-surface': '#ffffff',
    '--q-info': '#3b6ea8',
    '--q-success': '#356b44',
    '--q-warning': '#8d651a',
    '--q-danger': '#b3382e',
  },
  dark: {
    '--q-text-primary': '#ece6da',
    '--q-text-secondary': '#a69f90',
    '--q-text-muted': '#8f897f',
    '--q-border': '#2e2a24',
    '--q-accent': '#e08a5f',
    '--q-bg-surface': '#1c1917',
    '--q-info': '#7ca6d6',
    '--q-success': '#6baa7c',
    '--q-warning': '#c99a4c',
    '--q-danger': '#dc7b70',
  },
} as const satisfies Record<'light' | 'dark', Record<string, string>>;

/** Exported for the mirror guard only — not part of the module's API. */
export const CHART_FALLBACK_TOKENS = FALLBACK_TOKENS;

/**
 * Categorical series order for pie/donut slices: brand first, then the four status hues, then muted
 * for the tail. Named as variables rather than hexes so the palette has no copies of its own.
 */
const SERIES_VARS = [
  '--q-accent',
  '--q-info',
  '--q-success',
  '--q-warning',
  '--q-danger',
  '--q-text-muted',
] as const satisfies readonly (keyof (typeof FALLBACK_TOKENS)['light'])[];

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
  const fb = FALLBACK_TOKENS[resolved];
  /** Every read goes through the map, so no call site can name a hex of its own. */
  const read = (name: keyof typeof fb): string => cssVar(name, fb[name]);

  return {
    text: read('--q-text-primary'),
    textSecondary: read('--q-text-secondary'),
    textMuted: read('--q-text-muted'),
    line: read('--q-border'),
    accent: read('--q-accent'),
    surface: read('--q-bg-surface'),
    palette: SERIES_VARS.map(read),
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
