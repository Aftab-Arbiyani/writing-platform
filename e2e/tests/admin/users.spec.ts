import { test, expect } from '../../fixtures/test';
import { LoginPage } from '../../pages/shared/login-page';
import { AppNav } from '../../pages/frontend/app-nav';
import { UsersPage } from '../../pages/admin/users-page';

/**
 * Admin user management → cross-app effect (docs/e2e/06 Phase 2 + §7). Runs
 * authenticated as the super-admin (shared storageState). Proves the deepest
 * integration: an admin suspend changes what the FRONTEND app lets a user do.
 */
const FRONTEND_URL = process.env.E2E_BASE_URL_FRONTEND ?? 'http://localhost:5173';
const FE_LOGIN = { loginPath: '/auth/login', rememberLabel: 'Remember me' } as const;

test.describe('@phase2 admin users', () => {
  test('suspending a user blocks them from logging in on the frontend', async ({
    page,
    api,
    data,
    browser,
  }) => {
    // Arrange: a fresh, verified throwaway user (never the shared writer — docs/e2e/04 §6).
    const creds = { email: data.email(), username: data.username(), password: data.password() };
    const user = await api.createVerifiedUser(creds);

    // The account works before suspension (fresh frontend context).
    const before = await browser.newContext({
      baseURL: FRONTEND_URL,
      storageState: { cookies: [], origins: [] }, // force a guaranteed-anonymous context
    });
    const beforePage = await before.newPage();
    const beforeLogin = new LoginPage(beforePage, FE_LOGIN);
    await beforeLogin.goto();
    await beforeLogin.loginAs(creds.email, creds.password);
    await beforePage.waitForURL('**/feed');
    await new AppNav(beforePage).expectAuthenticated();
    await before.close();

    // Act: suspend via the admin UI.
    const users = new UsersPage(page);
    await users.goto();
    await users.searchFor(creds.username);
    await users.suspend(creds.username);

    // Assert the server-side side effect.
    expect((await api.getAdminUser(user.id)).status).toBe('suspended');

    // Assert the cross-app effect: a fresh login attempt now fails.
    const after = await browser.newContext({
      baseURL: FRONTEND_URL,
      storageState: { cookies: [], origins: [] }, // force a guaranteed-anonymous context
    });
    const afterPage = await after.newPage();
    const afterLogin = new LoginPage(afterPage, FE_LOGIN);
    await afterLogin.goto();
    await afterLogin.loginAs(creds.email, creds.password);
    await expect(afterPage).toHaveURL(/\/auth\/login/);
    await new AppNav(afterPage).expectAnonymous();
    await after.close();
  });
});
