import { freshLogin } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { AppNav } from '../../pages/frontend/app-nav';

/**
 * Frontend session — silent token refresh survives navigation (docs/e2e/06 Phase 3,
 * [03 §7]). A full reload drops the in-memory access token; on boot the app silently
 * refreshes from the httpOnly qalam_rt cookie (POST /auth/refresh) and stays signed in,
 * so guarded navigation continues to work with no visible login.
 */
test.describe('@phase3 frontend session', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'writer');
  });

  test('a reload silently refreshes the session and guarded navigation still works', async ({
    page,
  }) => {
    await page.goto('/feed');
    await new AppNav(page).expectAuthenticated();

    // Reload drops the in-memory token; the boot refresh fires exactly one POST /auth/refresh.
    const [refresh] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/auth/refresh') && r.request().method() === 'POST',
      ),
      page.reload(),
    ]);
    expect(refresh.ok()).toBeTruthy();

    // Still authenticated: a guarded route renders instead of bouncing to login.
    await page.goto('/me/drafts');
    await expect(page).toHaveURL(/\/me\/drafts/);
    await new AppNav(page).expectAuthenticated();
  });
});
