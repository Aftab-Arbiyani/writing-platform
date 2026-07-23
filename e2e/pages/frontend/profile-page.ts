import { type Locator, type Page, expect } from '@playwright/test';

/**
 * Reader/writer profile (docs/e2e app map, `features/profile`). `/me` redirects to
 * `/@:username`; other users are reached directly at `/@:username`. The header shows
 * the pen name (h1) + `@username`, an "Edit profile" link for self, and a Follow
 * button for everyone else.
 */
export class ProfilePage {
  constructor(private readonly page: Page) {}

  private get heading(): Locator {
    return this.page.getByRole('heading', { level: 1 });
  }
  private get editProfileLink(): Locator {
    return this.page.getByRole('link', { name: 'Edit profile' });
  }
  private followButton(name: string): Locator {
    // exact:true — "Follow"/"Following" would otherwise substring-match the
    // "followers"/"following" count buttons in the header.
    return this.page.getByRole('button', { name, exact: true });
  }

  /** Go to the signed-in user's own profile (/me → /@username). */
  async gotoOwn(): Promise<void> {
    await this.page.goto('/me');
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
  }

  /** Go to another user's public profile. */
  async gotoUser(username: string): Promise<void> {
    await this.page.goto(`/@${username}`);
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
  }

  /** Assert the profile shown is the given user (the `@username` line is the stable id). */
  async expectProfileOf(username: string): Promise<void> {
    await expect(this.page.getByText(`@${username}`, { exact: false })).toBeVisible();
  }

  async openEditProfile(): Promise<void> {
    await this.editProfileLink.click();
  }

  /** Follow a public user and confirm the button flips to "Following". */
  async follow(): Promise<void> {
    await this.followButton('Follow').click();
    await expect(this.followButton('Following')).toBeVisible();
  }

  async expectFollowing(): Promise<void> {
    await expect(this.followButton('Following')).toBeVisible();
  }
}
