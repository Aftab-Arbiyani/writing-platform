import { test, expect } from '../../fixtures/test';
import { AppNav } from '../../pages/frontend/app-nav';
import { LoginPage } from '../../pages/shared/login-page';

/**
 * Frontend authentication (docs/e2e/03, 06 Phase 1). These specs test login
 * FRESH, so they opt out of the shared writer session.
 */
test.describe('@phase1 frontend auth', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  const config = { loginPath: '/auth/login', rememberLabel: 'Remember me' } as const;
  const EMAIL = process.env.E2E_WRITER_EMAIL ?? 'writer@qalam.local';
  const PASSWORD = process.env.E2E_WRITER_PASSWORD ?? 'ChangeMe!Writer1';

  test('a writer can log in with valid credentials and reach the feed', async ({ page }) => {
    const login = new LoginPage(page, config);
    await login.goto();
    await login.loginAs(EMAIL, PASSWORD);
    await page.waitForURL('**/feed');
    await new AppNav(page).expectAuthenticated();
  });

  test('login is rejected with invalid credentials', async ({ page }) => {
    const login = new LoginPage(page, config);
    await login.goto();
    await login.loginAs(EMAIL, 'WrongPassword!999');
    // Stays on the login page, never authenticates.
    await expect(page).toHaveURL(/\/auth\/login/);
    await new AppNav(page).expectAnonymous();
  });

  test('a guarded route redirects an anonymous user to login', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('an authenticated user visiting login is redirected to the feed', async ({ page }) => {
    const login = new LoginPage(page, config);
    await login.goto();
    await login.loginAs(EMAIL, PASSWORD);
    await page.waitForURL('**/feed');
    // require-guest: hitting login while authed bounces to the feed.
    await page.goto('/auth/login');
    await expect(page).toHaveURL(/\/feed/);
  });

  test('a user can log out and can no longer reach a guarded route', async ({ page }) => {
    const login = new LoginPage(page, config);
    await login.goto();
    await login.loginAs(EMAIL, PASSWORD);
    await page.waitForURL('**/feed');

    const nav = new AppNav(page);
    await nav.logout();

    await page.goto('/settings');
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('registration creates an account and lands on email verification', async ({
    page,
    data,
  }) => {
    const username = data.username();
    await page.goto('/auth/register');
    await page.getByLabel('Email').fill(data.email());
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password', { exact: true }).fill('E2eRegister!123');
    await page.getByLabel('Confirm password').fill('E2eRegister!123');
    await page.getByRole('checkbox', { name: /I agree to the Terms of Service/i }).check();
    await page.getByRole('button', { name: 'Create account' }).click();
    // A confirmation dialog gates the actual submit.
    await page.getByRole('button', { name: 'Yes, this is me' }).click();
    // Success lands on the verify-email screen.
    await page.waitForURL('**/auth/verify-email');
  });
});
