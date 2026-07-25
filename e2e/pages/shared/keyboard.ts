import { type Locator, type Page, expect } from '@playwright/test';

/**
 * Keyboard-navigation helpers for the Phase-5 keyboard walkthrough ([10 §4.2]). The e2e
 * tsconfig deliberately omits the `dom` lib (see feed-page), so focus is probed through
 * Playwright's `toBeFocused` matcher rather than `document.activeElement` in `evaluate`.
 */

/** Non-throwing focus check — wraps the `toBeFocused` matcher so it can drive a loop. */
async function isFocused(locator: Locator): Promise<boolean> {
  try {
    await expect(locator).toBeFocused({ timeout: 250 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Press Tab (forward) until `target` holds focus or `max` presses elapse. Because it only ever
 * tabs forward, reaching `target` proves it sits in the tab order after the current position —
 * i.e. it is keyboard-reachable and nothing before it is a trap that swallows Tab. Returns
 * whether focus landed on the target.
 */
export async function tabUntilFocused(page: Page, target: Locator, max = 15): Promise<boolean> {
  if (await isFocused(target)) return true;
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await isFocused(target)) return true;
  }
  return false;
}

/** Assert `target` is reachable by forward-tabbing from the current focus, then leave it focused. */
export async function expectTabReachable(
  page: Page,
  target: Locator,
  label: string,
  max = 15,
): Promise<void> {
  const reached = await tabUntilFocused(page, target, max);
  expect(reached, `expected "${label}" to be reachable by keyboard (Tab) within ${max} steps`).toBe(
    true,
  );
}
