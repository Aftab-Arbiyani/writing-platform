import { type Page, expect } from '@playwright/test';

/**
 * Responsive helpers for the Phase-5 viewport projects (docs/e2e/10 §3). The e2e tsconfig omits
 * the `dom` lib (see feed-page), so DOM measurements go through string-form `page.evaluate`.
 */

/** Horizontal overflow in CSS px: how far the document is wider than the viewport (≤0 = none). */
export async function horizontalOverflowPx(page: Page): Promise<number> {
  const overflow = await page.evaluate(
    'document.documentElement.scrollWidth - document.documentElement.clientWidth',
  );
  return Number(overflow);
}

/**
 * Assert the page body does not scroll sideways at the current viewport ([10 §3.2]) — the single
 * most objective responsive check. A 1px tolerance absorbs sub-pixel rounding on fractional DPR.
 */
export async function expectNoHorizontalScroll(page: Page, label: string): Promise<void> {
  const overflow = await horizontalOverflowPx(page);
  expect(
    overflow,
    `${label} overflows horizontally by ${overflow}px at this viewport`,
  ).toBeLessThanOrEqual(1);
}

/** True when the current viewport is below the given CSS breakpoint (default Tailwind `md` = 768). */
export function isNarrowerThan(page: Page, breakpoint = 768): boolean {
  return (page.viewportSize()?.width ?? 0) < breakpoint;
}
