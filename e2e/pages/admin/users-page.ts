import { type Locator, type Page, expect } from '@playwright/test';

/**
 * Admin → Users management (docs/e2e app map). AntD table; per-row actions live
 * behind an icon button labelled "Actions for <username>"; destructive actions
 * route through a confirm dialog.
 */
export class UsersPage {
  constructor(private readonly page: Page) {}

  private get searchInput(): Locator {
    // An <input type="search"> reports role "searchbox", not "textbox";
    // getByLabel matches the aria-label regardless of the resolved role.
    return this.page.getByLabel('Search users');
  }
  private rowActions(username: string): Locator {
    return this.page.getByRole('button', { name: `Actions for ${username}` });
  }
  private get detailDrawer(): Locator {
    // Scoping container (data-testid="user-detail-drawer") — the AntD Drawer title
    // and Descriptions render as plain text with no stable accessible name, so we
    // scope assertions to the drawer body rather than the whole page.
    return this.page.getByTestId('user-detail-drawer');
  }
  private editDialog(username: string): Locator {
    return this.page.getByRole('dialog', { name: `Edit @${username}` });
  }
  private userRow(username: string): Locator {
    return this.page.getByRole('row').filter({ hasText: username });
  }

  async goto(): Promise<void> {
    await this.page.goto('/users');
    // Generous first-render wait for the Vite dev cold-compile of this route (local only).
    await expect(this.page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible({
      timeout: 30_000,
    });
  }

  /** Type into the debounced search box and wait for the target row to appear. */
  async searchFor(username: string): Promise<void> {
    await this.searchInput.fill(username);
    await expect(this.rowActions(username)).toBeVisible();
  }

  /** Suspend a user by username: open its row menu, click Suspend, confirm. */
  async suspend(username: string): Promise<void> {
    await this.rowActions(username).click();
    await this.page.getByRole('menuitem', { name: 'Suspend' }).click();
    const confirm = this.page.getByRole('dialog');
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: /suspend|confirm|yes/i }).click();
    await expect(confirm).toBeHidden();
  }

  /** Open a user's detail drawer via the row menu's "View profile". */
  async openProfile(username: string): Promise<void> {
    await this.rowActions(username).click();
    await this.page.getByRole('menuitem', { name: 'View profile' }).click();
    await expect(this.detailDrawer).toBeVisible();
  }

  /**
   * Assert the open detail drawer is showing the expected user. The email (unique per
   * user, rendered in the Overview) is the identity check; scoping to the drawer body
   * keeps it unambiguous vs. the same email in the table behind the drawer.
   */
  async expectProfileShows(email: string): Promise<void> {
    await expect(this.detailDrawer.getByText(email)).toBeVisible();
  }

  /**
   * Change a user's role via the Edit-user modal: open the row menu → "Edit user",
   * pick the role, save. Waits for the success toast + the modal to close so callers
   * can immediately assert the persisted role.
   */
  async changeRole(username: string, roleLabel: string): Promise<void> {
    await this.rowActions(username).click();
    await this.page.getByRole('menuitem', { name: 'Edit user' }).click();
    const dialog = this.editDialog(username);
    await expect(dialog).toBeVisible();

    await this.selectRole(dialog, roleLabel);
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(this.page.getByText(`Updated @${username}.`)).toBeVisible();
    await expect(dialog).toBeHidden();
  }

  /**
   * Choose a role in the Edit-user modal's AntD Select via keyboard. Clicking an option
   * is unreliable here — rc-select renders the dropdown in a body portal that can sit
   * outside the viewport and reports options as "not visible" (docs/e2e/05 §5). The
   * accessible keyboard path is robust: open, then ArrowDown until the combobox's
   * `aria-activedescendant` is the target option (the list wraps), then Enter to commit.
   */
  private async selectRole(dialog: Locator, roleLabel: string): Promise<void> {
    const combobox = dialog.getByRole('combobox', { name: 'Role' });
    // Open via keyboard, NOT a mouse click: the current value's selection-item span
    // overlays the tiny search input, and a (forced) click there is flaky across engines
    // (in Firefox it dismissed the modal). Focus + ArrowDown opens rc-select reliably.
    await combobox.focus();
    await combobox.press('ArrowDown');
    await expect(combobox).toHaveAttribute('aria-expanded', 'true');

    const targetId = await this.page
      .getByRole('option', { name: roleLabel, exact: true })
      .getAttribute('id');
    expect(targetId, `role option "${roleLabel}" not found`).not.toBeNull();

    // Walk the list with ArrowDown (it wraps) until the active option is the target, then
    // commit with Enter — avoids clicking a portal option that can render outside the viewport.
    await expect(async () => {
      const active = await combobox.getAttribute('aria-activedescendant');
      if (active !== targetId) {
        await combobox.press('ArrowDown');
        throw new Error(`active option ${active ?? 'none'} ≠ target ${targetId ?? ''}`);
      }
    }).toPass({ timeout: 5_000 });

    await combobox.press('Enter');
    await expect(combobox).toHaveAttribute('aria-expanded', 'false');
  }

  /** Assert the role tag shown in a user's table row (UI reflection of the change). */
  async expectRoleTag(username: string, roleLabel: string): Promise<void> {
    await expect(this.userRow(username).getByText(roleLabel, { exact: true })).toBeVisible();
  }
}
