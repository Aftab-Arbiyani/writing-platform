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
    textOnSolid: '#ffffff',
    // Darkened from #3e7c4f — QTag paints this token on a 12% tint of itself, which measured
    // 4.02:1 on canvas (W3c-2). Now 5.30 / 4.98 / 4.63. See tokens.css for the full note.
    success: '#356b44',
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
    accent: '#e08a5f',
    accentHover: '#eaa47d',
    // Dark mode's accent is light, so a solid accent fill needs DARK text, not white
    // (white on the rendered fill is 3.45:1; the ink is 5.45:1).
    textOnSolid: '#131110',
    success: '#6baa7c',
    warning: '#c99a4c',
    danger: '#dc7b70',
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
      // Label colour on solid accent fills (primary Button, solid Tag) — see palette note.
      colorTextLightSolid: c.textOnSolid,
      colorBorder: c.border,
      colorBorderSecondary: c.border,
      borderRadius: 6, // --q-radius-sm: controls
      borderRadiusLG: 10, // --q-radius-md: cards
      fontFamily: FONT_UI,
      controlHeight: 40,
    },
    components: {
      /*
       * Button: the DEFAULT (secondary) variant draws its hover label from AntD's derived
       * `colorPrimaryHover`, which lightens the seed — #ab6846 in light mode, 4.37:1 on surface and
       * 3.79:1 on raised, under AA (docs/e2e/10 §8.1, defect W3c-3). Any a11y scan that leaves the
       * cursor resting on a secondary button sees it, which is exactly what the W3c publishing scan
       * did. Pinned to the accent token itself: 6.02 / 5.63 / 5.21 light, 6.64 / 7.15 / 5.99 dark.
       *
       * NOT `accentHover` — the obvious choice measures 4.72:1 on surface but 4.41:1 on canvas, so it
       * would trade one AA failure for a subtler one. Hover here darkens toward the ink instead of
       * lightening away from it, which is also the right direction on paper.
       */
      Button: { controlHeight: 40, defaultHoverColor: c.accent },
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
