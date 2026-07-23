import { freshLoginAs } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';

/**
 * Admin RBAC boundary (docs/e2e/06 Phase 3). Mints a moderator, signs into the admin
 * panel as them (the shell floor is Role.Moderator, so they reach the dashboard), and
 * asserts the super-admin-only Roles screen is blocked — rendered as a 403 in place
 * (no redirect) with the nav item hidden. The guard is what's under test, so the
 * assertion is on the block, not on any moderator-visible screen.
 */
test.describe('@phase3 admin RBAC', () => {
  test('a moderator is blocked from the super-admin-only roles screen', async ({
    page,
    api,
    data,
  }) => {
    const moderator = await api.createModerator({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });
    // A fresh login AFTER the role change so the JWT claim is `moderator`.
    await freshLoginAs(page, moderator.email, moderator.password);

    // A moderator can reach the admin dashboard (shell floor = moderator).
    await page.goto('/dashboard');
    await expect(page.getByTestId('admin-header')).toBeVisible({ timeout: 30_000 });

    // The super-admin-only Roles screen renders the 403 page IN PLACE (no redirect).
    await page.goto('/roles');
    await expect(page.getByText(/access to this/i)).toBeVisible();
    await expect(page).toHaveURL(/\/roles/);
    await expect(page.getByRole('button', { name: 'Back to dashboard' })).toBeVisible();

    // And the Roles nav item is hidden for a non-super-admin.
    await expect(page.getByRole('menuitem', { name: 'Roles' })).toHaveCount(0);
  });
});
