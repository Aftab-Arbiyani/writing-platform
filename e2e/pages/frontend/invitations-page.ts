import { type Locator, type Page, expect } from '@playwright/test';

/**
 * The viewer's collaboration inbox (AF6 W3a, `features/collaboration` — route `/me/invitations`).
 * Pending invitations are the actionable ones; settled ones sit under "Earlier" as a record.
 */
export class InvitationsPage {
  constructor(private readonly page: Page) {}

  private get heading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Invitations' });
  }
  private get acceptButton(): Locator {
    return this.page.getByRole('button', { name: 'Accept' });
  }
  private get declineButton(): Locator {
    return this.page.getByRole('button', { name: 'Decline' });
  }
  private get emptyState(): Locator {
    return this.page.getByText('No invitations', { exact: true });
  }
  private get loadError(): Locator {
    return this.page.getByText('Couldn’t load your invitations.', { exact: true });
  }

  async goto(): Promise<void> {
    await this.page.goto('/me/invitations');
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
  }

  /** Resolved to a real-data state (a list OR the empty state), never an error. */
  async expectResolved(): Promise<void> {
    await expect(this.acceptButton.first().or(this.emptyState)).toBeVisible();
    await expect(this.loadError).toHaveCount(0);
  }

  async expectPending(): Promise<void> {
    await expect(this.acceptButton.first()).toBeVisible();
    await expect(this.declineButton.first()).toBeVisible();
  }

  /**
   * Accept the first pending invitation and wait for it to leave the list.
   *
   * `/me/invitations` is **pending-only**, so an accepted invitation stops being returned rather
   * than moving to a history section — with one invitation, the inbox lands on its empty state.
   */
  async acceptFirst(): Promise<void> {
    await this.acceptButton.first().click();
    await expect(this.emptyState).toBeVisible();
  }

  async expectEmpty(): Promise<void> {
    await expect(this.emptyState).toBeVisible();
  }
}
