import { useThemeStore, resolveTheme } from '@/stores/theme.store';

import { CHART_PALETTE } from '../analytics.constants';

export interface ChartTheme {
  palette: string[];
  text: string;
  axis: string;
  splitLine: string;
  tooltipBg: string;
  tooltipBorder: string;
}

const LIGHT: Omit<ChartTheme, 'palette'> = {
  text: '#334155',
  axis: '#cbd5e1',
  splitLine: '#e2e8f0',
  tooltipBg: '#ffffff',
  tooltipBorder: '#e2e8f0',
};

const DARK: Omit<ChartTheme, 'palette'> = {
  text: '#cbd5e1',
  axis: '#475569',
  splitLine: '#334155',
  tooltipBg: '#1e293b',
  tooltipBorder: '#334155',
};

/**
 * Theme-aware chart colours, reactive to the admin theme (`data-theme` on <html>,
 * driven by the theme store). Charts rebuild their options when this changes, so
 * axis/text/tooltip colours flip with light/dark mode. The categorical palette is
 * fixed (accessible in both themes).
 */
export function useChartTheme(): ChartTheme {
  const mode = useThemeStore((state) => state.mode);
  const resolved = resolveTheme(mode);
  return { palette: CHART_PALETTE, ...(resolved === 'dark' ? DARK : LIGHT) };
}
