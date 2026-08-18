import { type Locator, type Page, expect } from '@playwright/test';

/**
 * Click an item in an OPEN AntD `Dropdown`/`Menu` popup (docs/e2e/05 §5, [48 §3.18b]).
 *
 * **Never use `locator.click()` for these.** Not a preference — a measured race, and the one
 * §3.18b existed to find. `Dropdown` mounts its popup through rc-motion, which steps
 * `appear-prepare → appear-start → appear-active`. In **`appear-prepare`** the popup is
 * mounted, laid out at full height, visible, and its box is unchanged across frames — so
 * every one of Playwright's actionability checks (visible, stable, enabled, receives-events)
 * passes, honestly. `appear-start` then applies the entrance transform and collapses the
 * `<ul>` to zero height. Under parallel load those two states are tens of milliseconds apart,
 * which is long enough to land between `mousedown` and `mouseup`:
 *
 *     mousedown  → the <li> ("View profile")     ul height 248
 *     [appear-start applies]                     ul height 0
 *     mouseup    → the <ul>, no <li> under the pointer
 *     click      → fired on the <ul>, never on an <li>
 *
 * The browser fires `click` at the common ancestor of the mousedown and mouseup targets, so
 * rc-menu's item handler never runs: the menu stays open, the drawer/modal never mounts, and
 * **Playwright reports the click as successful** — it verifies the hit target for the FIRST
 * intercepted event only (`setupHitTargetInterceptor`, playwright-core 1.61.1), so a
 * `mouseup` that lands somewhere else is never checked.
 *
 * Dispatching on the element removes the mechanism instead of avoiding its window: there are
 * no coordinates to go stale, one event rather than a pair, and the locator is resolved at
 * dispatch time. The alternative — waiting out the entrance motion — would key on AntD's
 * `ant-slide-up-appear-*` class names, and a wait whose hook gets renamed degrades silently
 * back into this same flake.
 *
 * **What this trades, deliberately:** the pointer-level `receives-events` hit test, i.e. "no
 * other element covers this item". That is exactly the check whose unreliability IS the
 * defect. Visibility and enabled-ness are asserted here instead, and every caller still
 * asserts the portal the item opens — which is what the test is actually about.
 *
 * A human cannot reach this: `appear-prepare` is over before the menu is on screen to be
 * aimed at. It is a harness race, not an operator-facing bug.
 */
export async function clickAntdMenuItem(page: Page, name: string): Promise<void> {
  // Same matching as the `getByRole('menuitem', { name })` calls this replaces — whole
  // accessible name, case-insensitive — so "Suspend" still cannot match "Unsuspend".
  const item = page.getByRole('menuitem', { name });
  await expect(item).toBeVisible();
  await expect(item).toBeEnabled();
  await item.dispatchEvent('click');
}

/**
 * Select an option in an AntD `Select` by keyboard (docs/e2e/05 §5). Clicking a portal
 * option is unreliable — rc-select renders the dropdown in a body portal that can sit
 * outside the viewport and reports options as "not visible"; a forced click on the
 * overlaid combobox has dismissed modals (Firefox). The accessible keyboard path is
 * robust: focus → ArrowDown to open → ArrowDown until the combobox's
 * `aria-activedescendant` is the target option (the list wraps) → Enter to commit.
 *
 * `combobox` must resolve to the AntD Select's `role="combobox"` (give it an accessible
 * name via `aria-label`). `optionName` is matched exactly against `role="option"`.
 */
export async function selectAntdOption(
  page: Page,
  combobox: Locator,
  optionName: string,
): Promise<void> {
  await combobox.focus();
  await combobox.press('ArrowDown'); // open
  await expect(combobox).toHaveAttribute('aria-expanded', 'true');

  // rc-select virtualizes the dropdown: with many options only a couple are in the DOM at
  // once, so the target may not exist until we scroll to it. Press ArrowDown (which both
  // moves the active option AND scrolls the virtual list, rendering new rows) until the
  // target option is rendered and is the active descendant, then commit with Enter.
  const target = page.getByRole('option', { name: optionName, exact: true });
  await expect(async () => {
    if ((await target.count()) === 0) {
      await combobox.press('ArrowDown');
      throw new Error(`option "${optionName}" not rendered yet`);
    }
    const targetId = await target.getAttribute('id');
    const active = await combobox.getAttribute('aria-activedescendant');
    if (active !== targetId) {
      await combobox.press('ArrowDown');
      throw new Error(`active option ${active ?? 'none'} ≠ target ${targetId ?? ''}`);
    }
  }).toPass({ timeout: 10_000 });

  await combobox.press('Enter');
  await expect(combobox).toHaveAttribute('aria-expanded', 'false');
}
