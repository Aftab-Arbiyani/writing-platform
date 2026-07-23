import { test, expect } from '../../fixtures/test';
import { LoginPage } from '../../pages/shared/login-page';

/**
 * Admin authentication (docs/e2e/03, 06 Phase 1). Tests login fresh — opts out
 * of the shared super-admin session.
 */
test.describe('@phase1 admin auth', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  const config = { loginPath: '/login', rememberLabel: /remember me/i } as const;
  const EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@qalam.local';
  const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'ChangeMe!SuperAdmin1';

  test('a super-admin can log in and reach the dashboard', async ({ page }) => {
    const login = new LoginPage(page, config);
    await login.goto();
    await login.loginAs(EMAIL, PASSWORD);
    await page.waitForURL('**/dashboard');
    await expect(page.getByTestId('admin-header')).toBeVisible();
  });

  test('admin login is rejected with invalid credentials', async ({ page }) => {
    const login = new LoginPage(page, config);
    await login.goto();
    await login.loginAs(EMAIL, 'WrongPassword!999');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('an anonymous user is redirected away from a protected admin route', async ({ page }) => {
    await page.goto('/users');
    await expect(page).toHaveURL(/\/login/);
  });
});
