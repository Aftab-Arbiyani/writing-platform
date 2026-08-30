import { type Locator, type Page, expect } from '@playwright/test';

import { clickAntdMenuItem, selectAntdOption } from '../shared/antd';

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

  /**
   * Type into the debounced search box and wait for the search to have actually HAPPENED.
   *
   * The row assertion alone was not enough, and that is a correctness bug in this helper rather than a
   * timing preference. The box commits to the URL after a 350ms debounce
   * (`useDebouncedSearch`), the table's query key is built from the URL, and `useUsers` holds
   * `placeholderData: keepPreviousData` — so on a small database the target row is often ALREADY on
   * the unfiltered first page and `rowActions(username)` goes visible immediately, while the commit is
   * still pending. Every caller then interacted with a table that was about to re-render underneath
   * them.
   *
   * Waiting for the committed `?q=` and then for the row is waiting for the precondition the name of
   * this method implies. It is not a longer timeout: if the commit never lands, this still fails.
   */
  async searchFor(username: string): Promise<void> {
    await this.searchInput.fill(username);
    await this.page.waitForURL((url) => url.searchParams.get('q') === username, {
      timeout: 15_000,
    });
    await expect(this.rowActions(username)).toBeVisible();
  }

  /** Suspend a user by username: open its row menu, click Suspend, confirm. */
  async suspend(username: string): Promise<void> {
    await this.rowActions(username).click();
    await clickAntdMenuItem(this.page, 'Suspend');
    const confirm = this.page.getByRole('dialog');
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: /suspend|confirm|yes/i }).click();
    await expect(confirm).toBeHidden();
  }

  /** Open a user's detail drawer via the row menu's "View profile". */
  async openProfile(username: string): Promise<void> {
    await this.rowActions(username).click();
    await clickAntdMenuItem(this.page, 'View profile');
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
    // A PREVIOUS changeRole for this same user may still have its notification on screen —
    // AntD keeps one for ~4.5 s and `users.spec.ts` calls this twice in a row (grant, then
    // revoke). Two identical toasts made the assertion below a strict-mode violation.
    //
    // Waiting the old one out, rather than `.first()`-ing past it, is the point: `.first()`
    // would resolve to the STALE toast, so the assertion would pass without this save having
    // succeeded at all — green because of the defect, which is the failure mode this suite
    // keeps finding (48 §3.22, rule 3's neighbours). Clearing first also stops a lingering
    // notification overlaying the row menu, which is its own lost-click hazard (§3.18b).
    const toast = this.page.getByText(`Updated @${username}.`);
    await expect(toast).toHaveCount(0);

    await this.rowActions(username).click();
    await clickAntdMenuItem(this.page, 'Edit user');
    const dialog = this.editDialog(username);
    await expect(dialog).toBeVisible();

    await this.selectRole(dialog, roleLabel);
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    // Exactly one, and it is necessarily this save's: the slate was clean on entry.
    await expect(toast).toHaveCount(1);
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
    await selectAntdOption(this.page, dialog.getByRole('combobox', { name: 'Role' }), roleLabel);
  }

  /** Assert the role tag shown in a user's table row (UI reflection of the change). */
  async expectRoleTag(username: string, roleLabel: string): Promise<void> {
    await expect(this.userRow(username).getByText(roleLabel, { exact: true })).toBeVisible();
  }
}
