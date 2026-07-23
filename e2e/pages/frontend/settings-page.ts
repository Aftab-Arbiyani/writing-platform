import { type Locator, type Page, expect } from '@playwright/test';

/**
 * Settings → Edit profile (`/settings/profile`, `features/settings`). Fields are
 * `@qalam/ui` inputs with real `<label htmlFor>` (getByLabel works); a sticky Save bar
 * appears only when the form is dirty and confirms with a "Profile saved" toast.
 */
export class EditProfilePage {
  constructor(private readonly page: Page) {}

  private get penName(): Locator {
    return this.page.getByLabel('Pen name');
  }
  private get bio(): Locator {
    return this.page.getByLabel('Bio');
  }
  private get saveButton(): Locator {
    return this.page.getByRole('button', { name: 'Save changes' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/profile');
    await expect(this.penName).toBeVisible({ timeout: 30_000 });
  }

  async setPenName(value: string): Promise<void> {
    await this.penName.fill(value);
  }

  async setBio(value: string): Promise<void> {
    await this.bio.fill(value);
  }

  /** Save the dirty form and wait for the success toast. */
  async save(): Promise<void> {
    await this.saveButton.click();
    await expect(this.page.getByText('Profile saved')).toBeVisible();
  }
}

/**
 * Settings → Account (`/settings/account`). Change-password form (current + new +
 * confirm), submit "Update password", success toast "Password changed". The action
 * revokes the actor's other sessions, so it must run as a throwaway user.
 */
export class AccountSettingsPage {
  constructor(private readonly page: Page) {}

  private get currentPassword(): Locator {
    return this.page.getByLabel('Current password');
  }
  private get newPassword(): Locator {
    return this.page.getByLabel('New password', { exact: true });
  }
  private get confirmPassword(): Locator {
    return this.page.getByLabel('Confirm new password');
  }
  private get submit(): Locator {
    return this.page.getByRole('button', { name: 'Update password' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/account');
    await expect(this.currentPassword).toBeVisible({ timeout: 30_000 });
  }

  /** Change the password (new must be ≥10 chars and differ from current). */
  async changePassword(current: string, next: string): Promise<void> {
    await this.currentPassword.fill(current);
    await this.newPassword.fill(next);
    await this.confirmPassword.fill(next);
    await this.submit.click();
    await expect(this.page.getByText('Password changed')).toBeVisible();
  }
}
