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

  async logout(): Promise<void> {
    await this.accountMenu.click();
    await clickAntdMenuItem(this.page, 'Sign out');
    // Sign-out navigates to the landing route ('/').
    await expect(this.accountMenu).toBeHidden();
  }
}
