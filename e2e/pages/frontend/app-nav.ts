import { type Locator, type Page, expect } from '@playwright/test';

import { clickAntdMenuItem } from '../shared/antd';

/**
 * Frontend top-bar / account menu (docs/e2e app map). The "Account menu" button
 * renders only when authenticated, so it doubles as the logged-in marker.
 */
export class AppNav {
  constructor(private readonly page: Page) {}

  private get accountMenu(): Locator {
    return this.page.getByRole('button', { name: 'Account menu' });
  }
  private get signInButton(): Locator {
    return this.page.getByRole('button', { name: 'Sign in' });
  }

  async expectAuthenticated(): Promise<void> {
    await expect(this.accountMenu).toBeVisible();
  }

  async expectAnonymous(): Promise<void> {
    await expect(this.signInButton).toBeVisible();
  }

  /**
   * Open the account menu and activate one of its items.
   *
   * **Go through here rather than clicking the item directly.** The popup is an AntD
   * `Dropdown`, and a coordinate click landing in its entrance motion is silently lost —
   * the click is reported successful and the item's handler never runs ([48 §3.18b];
   * the mechanism is documented on {@link clickAntdMenuItem}). `reading-stats.spec.ts`
   * hand-rolled this click and was the one frontend call site still exposed to it
   * (**RS-flake**, reproduced 1 in 21 under 4-worker load, 2026-08-25).
   */
  async openAccountMenuItem(name: string): Promise<void> {
    await this.accountMenu.click();
    await clickAntdMenuItem(this.page, name);
  }

  async logout(): Promise<void> {
    await this.openAccountMenuItem('Sign out');
    // Sign-out navigates to the landing route ('/').
    await expect(this.accountMenu).toBeHidden();
  }
}
