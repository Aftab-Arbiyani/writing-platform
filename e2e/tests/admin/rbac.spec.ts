import { freshLoginAs } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { MONETIZATION_ROUTES, MonetizationPage } from '../../pages/admin/monetization-page';

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

  /**
   * A1's RBAC boundary, added here rather than in a parallel suite so the admin's permission gates
   * stay described in one place.
   *
   * The monetization routes are guarded by `RequirePermission(billing.manage)` rather than by a role
   * floor, because that is the permission every `admin/monetization` endpoint carries. A moderator
   * holds no `billing.*` grant (`DEFAULT_ROLE_PERMISSIONS`), so all seven routes must 403 in place and
   * every nav item must be absent. Both halves matter: a hidden nav item with a reachable URL is a
   * gate that is not one.
   */
  test('a moderator cannot reach any monetization route, and sees no billing nav', async ({
    page,
    api,
    data,
  }) => {
    const moderator = await api.createModerator({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });
    await freshLoginAs(page, moderator.email, moderator.password);

    await page.goto('/dashboard');
    await expect(page.getByTestId('admin-header')).toBeVisible({ timeout: 30_000 });

    // Not one of the seven nav entries is offered.
    for (const label of MonetizationPage.NAV_LABELS) {
      await expect(page.getByRole('menuitem', { name: label })).toHaveCount(0);
    }

    // And typing the URL gets an honest 403 IN PLACE, on every route.
    for (const route of MONETIZATION_ROUTES) {
      await page.goto(route.path);
      await expect(page.getByText(/access to this/i)).toBeVisible();
      await expect(page).toHaveURL(new RegExp(route.path.replace('/', '\\/')));
      // The page's own heading must never render — the guard sits above the route element.
      await expect(page.getByRole('heading', { level: 1, name: route.heading })).toHaveCount(0);
    }
  });
});
