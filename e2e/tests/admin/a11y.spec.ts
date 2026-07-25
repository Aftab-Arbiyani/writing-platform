import { expectNoSeriousA11yViolations } from '../../fixtures/a11y';
import { freshLogin } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { ADMIN_DASHBOARDS, DashboardsPage } from '../../pages/admin/dashboards-page';
import { ModerationPage } from '../../pages/admin/moderation-page';
import { UsersPage } from '../../pages/admin/users-page';
import { LoginPage } from '../../pages/shared/login-page';

/**
 * Admin accessibility (docs/e2e/06 Phase 5, [10 §4]). Axe (WCAG A + AA) scans the curated admin
 * pages ([10 §2.3]) at a stable, data-loaded state, gating on critical + serious only. AntD is a
 * mature accessible library, so this mostly guards our own composition (page headers, table
 * labels, dialog focus).
 */
test.describe('@phase5 @a11y admin accessibility (unauthenticated)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('admin login has no critical/serious a11y violations', async ({ page }) => {
    await new LoginPage(page, { loginPath: '/login', rememberLabel: /remember me/i }).goto();
    await expectNoSeriousA11yViolations(page, { label: 'admin /login' });
  });
});

test.describe('@phase5 @a11y admin accessibility (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'admin');
  });

  test('the dashboard has no critical/serious a11y violations', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByTestId('admin-header')).toBeVisible({ timeout: 30_000 });
    await expectNoSeriousA11yViolations(page, { label: 'admin /dashboard' });
  });

  test('the users table has no critical/serious a11y violations', async ({ page }) => {
    await new UsersPage(page).goto();
    await expectNoSeriousA11yViolations(page, { label: 'admin /users' });
  });

  test('the moderation queue has no critical/serious a11y violations', async ({ page }) => {
    await new ModerationPage(page).goto();
    await expectNoSeriousA11yViolations(page, { label: 'admin /reports' });
  });

  test('the analytics dashboard has no critical/serious a11y violations', async ({ page }) => {
    // The Analytics console is the curated dashboard for the a11y scan ([10 §2.3]).
    const analytics = ADMIN_DASHBOARDS.find((d) => d.key === 'analytics');
    const dashboards = new DashboardsPage(page);
    await dashboards.expectRenders(analytics!);
    await expectNoSeriousA11yViolations(page, { label: 'admin /analytics' });
  });
});
