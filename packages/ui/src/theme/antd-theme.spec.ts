import { theme as antdTheme } from 'antd';
import { describe, expect, it } from 'vitest';

import type { ThemeMode } from '../types.js';
import { getAntdTheme } from './antd-theme.js';

/**
 * **Every accent state clears WCAG AA against the label that paints on it.**
 *
 * Three defects with one cause are pinned here (docs/48 §3.22a): a hovered `variant="primary"`
 * rendering white on AntD's lightened `#ab6846` = 4.37:1 (**W8-5**), a DEFAULT button's held-down
 * label rendering `#996145` on dark backgrounds = 3.12–3.72:1 (**T-4**), and a pressed primary in
 * dark mode rendering the ink on that same `#996145` = 3.72:1 (found by this row).
 *
 * **Why a spec rather than a measurement.** All three are unreachable by an axe scan of a resting
 * page — hover needs a pointer parked on the control and press needs it held down — so the browser
 * suite cannot be the guard, and the hand measurements in §3.4/§3.12 were deleted with the throwaway
 * spec that made them (the §3.5 T-2b lesson: a measurement that gets deleted is not a guard).
 *
 * **Two properties make this a guard and not a snapshot of today's palette:**
 *
 * 1. It resolves the theme through **AntD's own algorithm** (`getDesignToken`), so it measures what
 *    the library really derives, not what the palette declares. An AntD upgrade that changes the
 *    derivation fails this file.
 * 2. It asserts the **rule** — every state moves the fill AWAY from its own label, so contrast is
 *    monotonically non-decreasing from rest to hover to press — not the six hexes. A new accent, or
 *    a fifth state, is covered the moment it exists.
 *
 * **What it is NOT:** a rendered scan. `docs/45 §2` step 5 is explicit that computed ratios are not
 * accepted as evidence on their own, and this file is a static check on resolved token values, with
 * no stylesheet, cascade or alpha compositing in it. It is the half that can run without a browser;
 * the `admin-dark`/`frontend-dark` a11y projects remain the authority on the rendered result.
 */

const MODES: readonly ThemeMode[] = ['light', 'dark'];

/** WCAG 2.1 relative luminance, per the spec's own formula. */
function luminance(hex: string): number {
  const raw = hex.replace('#', '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : raw;
  const channel = (pair: string): number => {
    const v = parseInt(pair, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(full.slice(0, 2)) +
    0.7152 * channel(full.slice(2, 4)) +
    0.0722 * channel(full.slice(4, 6))
  );
}

function contrast(a: string, b: string): number {
  const first = luminance(a);
  const second = luminance(b);
  const hi = Math.max(first, second);
  const lo = Math.min(first, second);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

/** AA for normal text. AntD's button label is 14px regular, so the large-text 3:1 never applies. */
const AA = 4.5;

/**
 * The theme as the app receives it: our `ThemeConfig` resolved through AntD's algorithm, so a
 * derived value and a pinned one are indistinguishable here — which is the point. Component tokens
 * are read off the config, because `getDesignToken` resolves global tokens only.
 */
function resolve(mode: ThemeMode) {
  const config = getAntdTheme(mode);
  const token = antdTheme.getDesignToken(config);
  const button = config.components?.Button ?? {};
  const menu = config.components?.Menu ?? {};

  return {
    token,
    /** The label AntD paints on a solid accent fill. */
    solidLabel: token.colorTextLightSolid,
    /** The three page backgrounds a button label can sit on, taken from the theme, not a copy. */
    backgrounds: [token.colorBgBase, token.colorBgContainer, String(menu.itemSelectedBg)],
    defaultHoverColor: String(button.defaultHoverColor),
    defaultActiveColor: String(button.defaultActiveColor),
  };
}

describe('getAntdTheme — a solid accent fill and its label (W8-5)', () => {
  it.each(MODES)('%s: rest, hover and press all clear AA with the solid label', (mode) => {
    const { token, solidLabel } = resolve(mode);

    for (const [state, fill] of [
      ['rest', token.colorPrimary],
      ['hover', token.colorPrimaryHover],
      ['press', token.colorPrimaryActive],
    ] as const) {
      expect(
        contrast(fill, solidLabel),
        `${mode} ${state} fill ${fill} on ${solidLabel}`,
      ).toBeGreaterThanOrEqual(AA);
    }
  });

  it.each(MODES)(
    '%s: each state moves the fill AWAY from its own label, never toward it',
    (mode) => {
      // The rule, asserted instead of the hexes. Both defects were the fill walking TOWARD the label:
      // light lightened white-ward, and dark darkened ink-ward. Monotonic non-decreasing contrast is
      // the one property that cannot be satisfied by accident.
      const { token, solidLabel } = resolve(mode);
      const rest = contrast(token.colorPrimary, solidLabel);
      const hover = contrast(token.colorPrimaryHover, solidLabel);
      const press = contrast(token.colorPrimaryActive, solidLabel);

      expect(
        hover,
        `${mode}: hover ${hover} must not read worse than rest ${rest}`,
      ).toBeGreaterThanOrEqual(rest);
      expect(
        press,
        `${mode}: press ${press} must not read worse than hover ${hover}`,
      ).toBeGreaterThanOrEqual(hover);
    },
  );

  it.each(MODES)('%s: hover and press are visibly distinct from rest', (mode) => {
    // A pin that satisfied AA by making every state identical would pass the two tests above and
    // remove the interaction feedback entirely.
    const { token } = resolve(mode);
    expect(
      new Set([token.colorPrimary, token.colorPrimaryHover, token.colorPrimaryActive]).size,
    ).toBe(3);
  });
});

describe('getAntdTheme — the DEFAULT button’s label (W3c-3, T-4)', () => {
  it.each(MODES)('%s: the hover label clears AA on all three page backgrounds', (mode) => {
    const { defaultHoverColor, backgrounds } = resolve(mode);

    for (const bg of backgrounds) {
      expect(
        contrast(defaultHoverColor, bg),
        `${mode} hover label on ${bg}`,
      ).toBeGreaterThanOrEqual(AA);
    }
  });

  it.each(MODES)('%s: the PRESSED label clears AA on all three page backgrounds', (mode) => {
    // T-4. Unpinned this is `colorPrimaryActive`, which in dark mode is 3.12 on raised — and no scan
    // can catch it, because it only paints while the pointer is held down.
    const { defaultActiveColor, backgrounds } = resolve(mode);

    for (const bg of backgrounds) {
      expect(
        contrast(defaultActiveColor, bg),
        `${mode} pressed label on ${bg}`,
      ).toBeGreaterThanOrEqual(AA);
    }
  });
});

describe('getAntdTheme — what AntD derives when nothing is pinned', () => {
  /*
   * The defect itself, kept executable. This is what the theme rendered before the pins, and it is
   * here so the pins cannot be deleted as "probably unnecessary now" without something failing.
   *
   * If a future AntD changes its derivation and these start passing, that is a real signal and not a
   * broken test: re-measure, and retire the pin deliberately rather than by deletion.
   */
  const SEED = { light: '#9e4b28', dark: '#e08a5f' } as const;
  const LABEL = { light: '#ffffff', dark: '#131110' } as const;

  it.each(MODES)(
    '%s: the unpinned derivation is still the thing being protected against',
    (mode) => {
      const bare = antdTheme.getDesignToken({
        algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: { colorPrimary: SEED[mode], colorTextLightSolid: LABEL[mode] },
      });

      const failing =
        mode === 'light'
          ? contrast(bare.colorPrimaryHover, LABEL[mode]) // #ab6846 → 4.37:1
          : contrast(bare.colorPrimaryActive, LABEL[mode]); // #996145 → 3.72:1

      expect(failing).toBeLessThan(AA);
      // And the pinned theme fixes exactly that pair.
      const pinned = resolve(mode);
      const fixed =
        mode === 'light'
          ? contrast(pinned.token.colorPrimaryHover, pinned.solidLabel)
          : contrast(pinned.token.colorPrimaryActive, pinned.solidLabel);
      expect(fixed).toBeGreaterThanOrEqual(AA);
    },
  );
});
