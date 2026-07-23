import { type Locator, type Page, expect } from '@playwright/test';

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
