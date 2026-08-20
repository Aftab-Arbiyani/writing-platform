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
    /*
     * The accent as a SOLID FILL under the pointer and under the press — a different job from
     * `accentHover`, which is a link/label colour on a page background. AntD derives these by
     * lightening the seed, and white-on-lightened fails AA: #ab6846 measured 4.37:1 with the
     * white label (W8-5), and a pressed primary in DARK mode measured 3.72:1 with the ink label.
     *
     * The rule both modes now follow: **hover and press move the fill AWAY from its own label
     * colour**, so contrast can only go up. Light mode darkens toward the ink (7.00 hover / 9.26
     * press with white); dark mode brightens away from it (8.20 / 9.06 with the dark ink label).
     * `accentSolidActive` in light mode is AntD's own derived value, kept so nothing changes
     * visually there — it was already correct, and pinning it only stops the algorithm drifting it.
     */
    accentSolidHover: '#8e4424',
    accentSolidActive: '#783218',
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
    /*
     * Dark mode brightens instead of darkening, because its solid label is the dark ink — see the
     * light-mode note above for the shared rule. `accentSolidHover` is AntD's own derived hover
     * (#d79f7e, 8.20:1 with the ink), pinned rather than changed: it was already correct and only
     * needed to stop being derived. `accentSolidActive` is the value `accentHover` also carries
     * today — deliberately its own entry, so changing the link-hover colour later cannot silently
     * move a button's pressed fill.
     */
    accentSolidHover: '#d79f7e',
    accentSolidActive: '#eaa47d',
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
      /*
       * The solid accent's hover and press fills (W8-5, and the dark-mode press found with it).
       * AntD derives both from the seed by lightening, which walks the fill TOWARD its own label:
       * a hovered `variant="primary"` rendered white on #ab6846 = 4.37:1, and a pressed one in dark
       * mode rendered the ink on #996145 = 3.72:1. Both under AA, and neither reachable by an axe
       * scan of a resting page — which is why they outlived every scan the suite runs.
       *
       * Pinned in `token` rather than scoped to `components.Button`: these are alias tokens with
       * many consumers (Switch, Slider, Radio, Pagination), all of which inherit the same
       * lightening, and a Button-scoped override would fix the one component an audit happened to
       * look at. The other consumers paint them as non-text, where the threshold is 3:1 and a
       * higher-contrast fill is strictly better.
       */
      colorPrimaryHover: c.accentSolidHover,
      colorPrimaryActive: c.accentSolidActive,
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
       *
       * `defaultActiveColor` is the same defect one state later (**T-4**): the derived
       * `colorPrimaryActive` renders the label #996145 in dark mode, which is 3.72 / 3.46 / 3.12 on
       * canvas / surface / raised — all under AA. It went unseen for a reason worth keeping: it only
       * paints while the pointer is HELD DOWN, so no axe scan of a page can reach it, and the pin is
       * the only thing that can. Same token as the hover, giving 5.63 / 6.02 / 5.21 light and
       * 7.15 / 6.64 / 5.99 dark. The press stays legible as a press through the border and
       * background AntD moves with it, not through the label.
       */
      Button: { controlHeight: 40, defaultHoverColor: c.accent, defaultActiveColor: c.accent },
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
