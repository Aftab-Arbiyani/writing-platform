import { freshLogin } from '../../fixtures/auth';
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
  // Fresh token family per test — the shared storageState is single-use (see fixtures/auth).
  // Applies to the admin `page`; the cross-app test's extra frontend contexts log in themselves.
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'admin');
  });

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

  test('a super-admin can search for a user and open their profile', async ({
    page,
    api,
    data,
  }) => {
    // A throwaway, verified user so we never open (or mutate) the shared writer.
    const creds = { email: data.email(), username: data.username(), password: data.password() };
    await api.createVerifiedUser(creds);

    const users = new UsersPage(page);
    await users.goto();
    await users.searchFor(creds.username);
    await users.openProfile(creds.username);

    // The detail drawer shows exactly this user (email is the unique identity check).
    await users.expectProfileShows(creds.email);
  });

  test('a super-admin grants then revokes a role, and the change persists', async ({
    page,
    api,
    data,
  }) => {
    const creds = { email: data.email(), username: data.username(), password: data.password() };
    const user = await api.createVerifiedUser(creds); // seeded as the default 'user' role

    const users = new UsersPage(page);
    await users.goto();
    await users.searchFor(creds.username);

    // Grant: promote to Moderator via the Edit-user modal.
    await users.changeRole(creds.username, 'Moderator');
    await users.expectRoleTag(creds.username, 'Moderator'); // UI reflects the change
    expect((await api.getAdminUser(user.id)).role).toBe('moderator'); // server-side side effect

    // Revoke: return to the base User role.
    await users.changeRole(creds.username, 'User');
    await users.expectRoleTag(creds.username, 'User');
    expect((await api.getAdminUser(user.id)).role).toBe('user');
  });
});
