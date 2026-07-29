import { type Locator, type Page, expect } from '@playwright/test';

/**
 * Safety settings (AF6 W3c — `/settings/blocks`): the viewer's blocked/muted list and their own
 * account standing.
 *
 * **Mobile has no equivalent screen**, so nothing here is a port — it is built from the trust DTOs
 * (docs/48 §3.3). The one mobile defect worth encoding as a test is `T-1`: `BlockDto.id` is the
 * relationship and `blockedId` is the person, and mixing them up makes unblocking impossible while
 * looking perfectly fine. `unblockFirst` proves the round trip end to end — the row disappears only
 * if the server accepted the id the client sent.
 */
export class SettingsBlocksPage {
  constructor(private readonly page: Page) {}

  private get heading(): Locator {
    return this.page.getByRole('heading', { name: 'Safety', exact: true });
  }

  private get blockedSection(): Locator {
    return this.page.getByRole('region', { name: 'Blocked and muted' });
  }

  private get standingSection(): Locator {
    return this.page.getByRole('region', { name: 'Account standing' });
  }

  private get rows(): Locator {
    return this.blockedSection.getByRole('listitem');
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/blocks');
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
  }

  async expectResolved(): Promise<void> {
    await expect(this.page.getByText('Collaboration is off')).toHaveCount(0);
    await expect(this.blockedSection).toBeVisible();
  }

  /** The nav offers Safety only while collaboration is on — E2E runs it on. */
  async expectInSettingsNav(): Promise<void> {
    await expect(
      this.page.getByRole('navigation', { name: 'Settings sections' }).getByRole('link', {
        name: 'Safety',
      }),
    ).toBeVisible();
  }

  async expectStanding(label: string): Promise<void> {
    await expect(this.standingSection.getByText(label, { exact: true })).toBeVisible();
  }

  async expectEmpty(): Promise<void> {
    await expect(this.page.getByText(/haven’t blocked or muted anyone/)).toBeVisible();
  }

  async expectRowCount(count: number): Promise<void> {
    await expect(this.rows).toHaveCount(count);
  }

  /** Asserts the kind tag, which is the only thing distinguishing a block from a mute. */
  async expectKind(kind: 'Blocked' | 'Muted'): Promise<void> {
    await expect(this.blockedSection.getByText(kind, { exact: true }).first()).toBeVisible();
  }

  /**
   * Remove the entry whose action is `action`, through its confirm dialog. The row leaving the list
   * is the assertion: it can only happen if `DELETE /users/:id/{block,mute}` was given the blocked
   * USER's id (T-1).
   *
   * The row is found by its ACTION, never by position: `GET /me/blocks` does not promise an order
   * (it came back mute-first for a block created first), so `rows.first()` picks a different kind
   * run to run — which is how this failed the first time it ran.
   */
  async remove(action: 'Unblock' | 'Unmute'): Promise<void> {
    const before = await this.rows.count();
    const button = this.rows.getByRole('button', { name: action, exact: true }).first();
    await button.click();
    const dialog = this.page.getByRole('dialog');
    await dialog.getByRole('button', { name: action, exact: true }).click();
    await expect(this.rows).toHaveCount(before - 1);
  }
}
