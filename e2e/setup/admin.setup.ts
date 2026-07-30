import { test as setup, expect } from '@playwright/test';

import { LoginPage } from '../pages/shared/login-page';

/**
 * Admin auth setup (docs/e2e/03). Logs in ONCE as the seeded super-admin and
 * saves the session for every admin spec. Chromium only; state reused across engines.
 */
const authFile = '.auth/admin.json';

const EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@qalam.local';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'ChangeMe!SuperAdmin1';

setup('authenticate as super-admin', async ({ page }) => {
  const login = new LoginPage(page, {
    loginPath: '/login',
    rememberLabel: /remember me/i,
  });
  await login.goto();
  await login.loginAs(EMAIL, PASSWORD, true);

  await page.waitForURL('**/dashboard');
  await expect(page.getByTestId('admin-header')).toBeVisible();

  await page.context().storageState({ path: authFile });
});
