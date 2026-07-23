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
}
