import { type Locator, type Page, expect } from '@playwright/test';

/**
 * Admin → Audit logs (`/audit-logs`, docs/e2e app map). AntD table; the Action column
 * renders the raw action code (e.g. "user.suspend") in a mono span. Rows carry no
 * data-testid, so a test narrows by searching the exact target/actor id, then asserts
 * the action code text is present.
 */
export class AuditPage {
  constructor(private readonly page: Page) {}

  private get heading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Audit logs' });
  }
  private get search(): Locator {
    return this.page.getByLabel('Search audit logs');
  }

  async goto(): Promise<void> {
    await this.page.goto('/audit-logs');
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
  }

  /** Filter the log to an exact actor/target id (the toolbar supports id search). */
  async filterBy(idOrCode: string): Promise<void> {
    await this.search.fill(idOrCode);
  }

  /** Assert an entry with the given action code is shown. */
  async expectAction(actionCode: string): Promise<void> {
    await expect(this.page.getByText(actionCode).first()).toBeVisible();
  }
}
