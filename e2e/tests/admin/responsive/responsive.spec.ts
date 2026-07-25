import { freshLogin } from '../../../fixtures/auth';
import { test, expect } from '../../../fixtures/test';
import { UsersPage } from '../../../pages/admin/users-page';
import { expectNoHorizontalScroll } from '../../../pages/shared/viewport';

/**
 * Admin responsive (docs/e2e/06 Phase 5, [10 §3]). Runs ONLY in the admin mobile + tablet viewport
 * projects. Both widths are below the admin shell's `lg` breakpoint, so the persistent rail is
 * hidden and navigation lives behind the header's "Open navigation" toggle → a drawer; this asserts
 * that path works, that the console does not scroll sideways, and that a core screen loads.
 */
test.describe('@phase5 @responsive admin', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'admin');
  });

  test('key screens do not scroll horizontally', async ({ page }) => {
    const screens: ReadonlyArray<{ path: string; heading: string }> = [
      { path: '/dashboard', heading: '' }, // dashboard heading varies; assert the header instead
      { path: '/users', heading: 'Users' },
      { path: '/analytics', heading: 'Analytics' },
    ];

    for (const { path, heading } of screens) {
      await page.goto(path);
      if (heading) {
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible({
          timeout: 30_000,
        });
      } else {
        await expect(page.getByTestId('admin-header')).toBeVisible({ timeout: 30_000 });
      }
      await expectNoHorizontalScroll(page, `admin ${path}`);
    }
  });

  test('the navigation drawer opens from the header at this viewport', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByTestId('admin-header')).toBeVisible({ timeout: 30_000 });

    // Below lg, the rail collapses into a drawer opened by the header toggle.
    await page.getByRole('button', { name: 'Open navigation' }).click();

    // The drawer exposes the nav; a known destination (Users) proves it is reachable.
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('menuitem', { name: 'Users' })).toBeVisible();
  });

  test('the users console loads at this viewport (core journey)', async ({ page }) => {
    const users = new UsersPage(page);
    await users.goto();
    await expectNoHorizontalScroll(page, 'admin /users');
  });
});
