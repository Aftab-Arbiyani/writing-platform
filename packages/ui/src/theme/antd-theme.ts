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
    raised: '#f3eee5',
    textPrimary: '#24211b',
    textSecondary: '#6b655a',
    textMuted: '#726c61',
    border: '#e7e1d6',
    accent: '#9e4b28',
    accentHover: '#b45a32',
    success: '#3e7c4f',
    warning: '#8d651a',
    danger: '#b3382e',
    info: '#3b6ea8',
  },
  dark: {
    canvas: '#131110',
    surface: '#1c1917',
    raised: '#26221e',
    textPrimary: '#ece6da',
    textSecondary: '#a69f90',
    textMuted: '#8f897f',
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
      /*
       * AntD derives its "muted" text colours as low-alpha ink over the surface, which lands
       * below WCAG AA — e.g. Input's character counter at 2.72:1 and Select's placeholder.
       * Pinning them to the muted token (5.21:1 on surface) fixes every consumer at once
       * instead of patching component by component (docs/e2e/10 §8.1).
       */
      colorTextDescription: c.textMuted,
      colorTextPlaceholder: c.textMuted,
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
      /*
       * Menu: AntD's derived defaults fail WCAG AA here (docs/e2e/10 §8.1).
       *  - group titles derive from `colorTextDescription` — ~45% alpha over the ink base,
       *    which renders #9c9b98 on white = 2.77:1. Pinned to the secondary-text token
       *    (5.78:1 light / 6.65:1 dark).
       *  - the selected item drew the accent over `controlItemBgActive` (#ded7d1) = 4.22:1.
       *    Pinning the selected background to the `raised` token lifts it to 5.21:1 light /
       *    4.68:1 dark while keeping the terracotta selection cue.
       */
      Menu: {
        groupTitleColor: c.textSecondary,
        itemSelectedBg: c.raised,
        itemSelectedColor: c.accent,
      },
    },
  };
}
