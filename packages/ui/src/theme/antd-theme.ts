import { theme as antdTheme } from 'antd';
import type { ThemeConfig } from 'antd';

import type { ThemeMode } from '../types.js';

/**
 * Hexes mirror styles/tokens.css — the single token source (ADR §7).
 * Keep in sync until the Phase 1.5 token build step generates both
 * artifacts from one definition.
 */
const palette = {
  light: {
    canvas: '#faf7f1',
    surface: '#ffffff',
    textPrimary: '#24211b',
    textSecondary: '#6b655a',
    border: '#e7e1d6',
    accent: '#9e4b28',
    accentHover: '#b45a32',
    success: '#3e7c4f',
    warning: '#a97a1f',
    danger: '#b3382e',
    info: '#3b6ea8',
  },
  dark: {
    canvas: '#131110',
    surface: '#1c1917',
    textPrimary: '#ece6da',
    textSecondary: '#a69f90',
    border: '#2e2a24',
    accent: '#d07349',
    accentHover: '#dd8a63',
    success: '#6baa7c',
    warning: '#c99a4c',
    danger: '#d06a5f',
    info: '#7ca6d6',
  },
} satisfies Record<ThemeMode, Record<string, string>>;

const FONT_UI = [
  'Inter',
  'Noto Sans Devanagari',
  'Noto Naskh Arabic',
  '-apple-system',
  'BlinkMacSystemFont',
  'Segoe UI',
  'system-ui',
  'sans-serif',
].join(', ');

/**
 * AntD theme derived from the Qalam tokens, one per mode. Feed the result to
 * `<ConfigProvider theme={getAntdTheme(mode)}>`; Tailwind reads the same
 * tokens via styles/tailwind.css, so both systems stay on one palette.
 */
export function getAntdTheme(mode: ThemeMode): ThemeConfig {
  const c = palette[mode];

  return {
    algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: c.accent,
      colorLink: c.accent,
      colorLinkHover: c.accentHover,
      colorSuccess: c.success,
      colorWarning: c.warning,
      colorError: c.danger,
      colorInfo: c.info,
      colorBgBase: c.canvas,
      colorBgContainer: c.surface,
      colorBgElevated: c.surface,
      colorTextBase: c.textPrimary,
      colorTextSecondary: c.textSecondary,
      colorBorder: c.border,
      colorBorderSecondary: c.border,
      borderRadius: 6, // --q-radius-sm: controls
      borderRadiusLG: 10, // --q-radius-md: cards
      fontFamily: FONT_UI,
      controlHeight: 40,
    },
    components: {
      Button: { controlHeight: 40 },
      Card: { borderRadiusLG: 10 },
      Modal: { borderRadiusLG: 16 }, // --q-radius-lg
    },
  };
}
