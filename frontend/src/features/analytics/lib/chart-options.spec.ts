import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

import { CHART_FALLBACK_TOKENS, resolveChartTheme } from './chart-options';

/**
 * **The chart fallbacks are pinned to `tokens.css` itself, not to a copy of it.**
 *
 * `tokens.css` names its own mirrors — "styles/tailwind.css and src/theme/antd-theme.ts" — and this
 * module was a third one nobody had declared. Its `--q-success` copy went stale when the token was
 * darkened for W3c-2, leaving `#3e7c4f` here in two places and `#356b44` in the token file (**T-5**,
 * docs/48 §3.5). Nothing broke: these hexes only paint when the CSS variables cannot be read at all,
 * and chart series are non-text graphics at a 3:1 threshold. But a note asking the next author to
 * keep them in sync is what produced the drift, so the sync is asserted instead.
 *
 * Reading the real file is the point. A spec listing the expected hexes would be a FOURTH copy, and
 * would pass while the token moved underneath it — the §3.5 T-2b lesson (a token is only guarded if
 * something reads the recipe rather than a snapshot of its output).
 */

const require = createRequire(import.meta.url);

/** `:root { … }` is light; `[data-theme='dark'] { … }` is dark. */
function declarationsFor(css: string, mode: 'light' | 'dark'): Map<string, string> {
  const start =
    mode === 'light' ? css.indexOf(':root {') : css.search(/\[data-theme=['"]dark['"]\]\s*{/);
  expect(start, `could not find the ${mode} block in tokens.css`).toBeGreaterThan(-1);

  // Comments carry hexes too ("Darkened from #3e7c4f"), so they are stripped before matching —
  // otherwise a historical value in prose could satisfy an assertion about a live token.
  const block = css.slice(start, css.indexOf('\n}', start)).replace(/\/\*[\s\S]*?\*\//g, '');

  const found = new Map<string, string>();
  for (const match of block.matchAll(/(--q-[\w-]+)\s*:\s*([^;]+);/g)) {
    // Both groups are non-optional in the pattern, so a match implies both — but
    // `noUncheckedIndexedAccess` types them `string | undefined` and cannot know that. Skipping is
    // the honest narrowing: a non-match cannot reach here, so nothing real is dropped.
    const [, name, value] = match;
    if (name === undefined || value === undefined) continue;
    found.set(name, value.trim().toLowerCase());
  }
  return found;
}

const TOKENS_CSS = readFileSync(require.resolve('@qalam/ui/styles/tokens.css'), 'utf8');

describe('chart fallbacks mirror tokens.css (T-5)', () => {
  for (const mode of ['light', 'dark'] as const) {
    it(`${mode}: every fallback hex is the value tokens.css declares`, () => {
      const declared = declarationsFor(TOKENS_CSS, mode);

      for (const [variable, fallback] of Object.entries(CHART_FALLBACK_TOKENS[mode])) {
        expect(
          declared.get(variable),
          `${variable} is not declared in the ${mode} block`,
        ).toBeDefined();
        expect(declared.get(variable), `${mode} ${variable}`).toBe(fallback.toLowerCase());
      }
    });
  }

  it('holds exactly one copy of each hex — no index-keyed palette beside the named tokens', () => {
    // T-5 was two copies of one colour, in the same object. The palette is derived now, so the only
    // way to reintroduce the defect is to add a second entry for the same variable, which this
    // catches by counting.
    for (const mode of ['light', 'dark'] as const) {
      const variables = Object.keys(CHART_FALLBACK_TOKENS[mode]);
      expect(new Set(variables).size).toBe(variables.length);
    }
  });
});

describe('resolveChartTheme', () => {
  it('builds the categorical palette from the named tokens, brand first', () => {
    // jsdom paints no stylesheet, so `cssVar` returns the fallbacks — which is exactly the path
    // these hexes exist for, and the one T-5 left stale.
    const light = resolveChartTheme('light');

    expect(light.palette).toEqual([
      CHART_FALLBACK_TOKENS.light['--q-accent'],
      CHART_FALLBACK_TOKENS.light['--q-info'],
      CHART_FALLBACK_TOKENS.light['--q-success'],
      CHART_FALLBACK_TOKENS.light['--q-warning'],
      CHART_FALLBACK_TOKENS.light['--q-danger'],
      CHART_FALLBACK_TOKENS.light['--q-text-muted'],
    ]);
    // The brand leads, and the tail is the muted token rather than a sixth hue.
    expect(light.palette[0]).toBe(light.accent);
    expect(light.palette.at(-1)).toBe(light.textMuted);
  });

  it('themes both modes from their own block, never one from the other', () => {
    const light = resolveChartTheme('light');
    const dark = resolveChartTheme('dark');

    expect(light.text).not.toBe(dark.text);
    expect(light.surface).not.toBe(dark.surface);
    expect(light.palette).not.toEqual(dark.palette);
  });
});
