import { freshLoginAs } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { AccountSettingsPage } from '../../pages/frontend/settings-page';

/**
 * Frontend settings → change password (docs/e2e/06 Phase 3, `features/settings`).
 * Runs as a throwaway user (never the shared writer): change-password revokes the
 * actor's other sessions, so it must not disturb the shared fixtures.
 */
test.describe('@phase3 frontend settings', () => {
  test('a user changes their password and the new one works', async ({ page, api, data }) => {
    const creds = { email: data.email(), username: data.username(), password: data.password() };
    await api.createVerifiedUser(creds);
    await freshLoginAs(page, creds.email, creds.password);

    const account = new AccountSettingsPage(page);
    await account.goto();
    const newPassword = `NewE2ePass!${data.username()}`; // ≥10 chars, differs from current
    await account.changePassword(creds.password, newPassword); // asserts "Password changed"

    // Server-side side effect: the new password authenticates.
    const result = await api.login(creds.email, newPassword);
    expect(result.accessToken).toBeTruthy();
  });
});
