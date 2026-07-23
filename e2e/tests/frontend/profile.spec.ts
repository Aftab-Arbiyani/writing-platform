import { freshLogin } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { EditProfilePage } from '../../pages/frontend/settings-page';
import { ProfilePage } from '../../pages/frontend/profile-page';

/**
 * Frontend profile (docs/e2e/06 Phase 3, `features/profile` + `features/settings`).
 * Runs as the seeded writer; the follow journey arranges a throwaway public 2nd user.
 */
test.describe('@phase3 frontend profile', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'writer');
  });

  test('a writer views their own profile and edits it', async ({ page, data }) => {
    const profile = new ProfilePage(page);
    await profile.gotoOwn();

    // Edit the bio and save (Save bar appears only when the form is dirty).
    await profile.openEditProfile();
    const edit = new EditProfilePage(page);
    const bio = `E2E bio ${data.username()}`;
    await edit.setBio(bio);
    await edit.save();

    // The saved bio shows back on the profile.
    await profile.gotoOwn();
    await expect(page.getByText(bio)).toBeVisible();
  });

  test('a writer follows another user', async ({ page, api, data }) => {
    // A throwaway, verified, public 2nd user to follow.
    const other = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });

    const profile = new ProfilePage(page);
    await profile.gotoUser(other.username);
    await profile.expectProfileOf(other.username);

    // Act via UI; the button flips to "Following" only after the server confirms the
    // follow (public target → accepted), so it is the authoritative outcome.
    await profile.follow();
    await profile.expectFollowing();
  });
});
