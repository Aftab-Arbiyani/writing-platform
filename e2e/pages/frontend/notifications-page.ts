import { type Locator, type Page, expect } from '@playwright/test';

/**
 * In-app notifications inbox (`/notifications`, `features/notifications`, m8 poll model).
 * The list has no auto-poll/refresh control, so a test reloads the route after arranging
 * the triggering action (e.g. another user follows you → "started following you").
 */
export class NotificationsPage {
  constructor(private readonly page: Page) {}

  private get heading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Notifications' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/notifications');
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
  }

  /**
   * Assert a notification whose text matches appears. The inbox has no auto-poll and the
   * triggering event is created post-commit, so this reloads between checks until the
   * notification lands (bounded).
   */
  async expectNotification(text: string | RegExp): Promise<void> {
    await expect(async () => {
      await this.page.reload();
      await expect(this.heading).toBeVisible({ timeout: 30_000 });
      await expect(this.page.getByText(text).first()).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
  }
}
