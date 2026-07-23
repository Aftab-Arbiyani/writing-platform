import { test as setup, expect } from '@playwright/test';

import { AppNav } from '../pages/frontend/app-nav';
import { LoginPage } from '../pages/shared/login-page';

/**
 * Frontend auth setup (docs/e2e/03). Logs in ONCE as the seeded writer with
 * "Remember me" on (persists the refresh cookie) and saves the session so every
 * frontend spec starts authenticated. Runs in chromium only — the saved state is
 * engine-agnostic and reused across firefox/webkit.
 */
const authFile = '.auth/frontend.json';

const EMAIL = process.env.E2E_WRITER_EMAIL ?? 'writer@qalam.local';
const PASSWORD = process.env.E2E_WRITER_PASSWORD ?? 'ChangeMe!Writer1';

setup('authenticate as writer', async ({ page }) => {
  const login = new LoginPage(page, { loginPath: '/auth/login', rememberLabel: 'Remember me' });
  await login.goto();
  await login.loginAs(EMAIL, PASSWORD, true);

  // Redirect to the feed proves auth succeeded; the account menu confirms it.
  await page.waitForURL('**/feed');
  await new AppNav(page).expectAuthenticated();

  await page.context().storageState({ path: authFile });
  expect(EMAIL).toBeTruthy();
});
