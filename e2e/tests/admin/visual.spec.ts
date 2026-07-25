import { freshLogin } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { UsersPage } from '../../pages/admin/users-page';
import { LoginPage } from '../../pages/shared/login-page';

/**
 * Admin visual regression (docs/e2e/06 Phase 5, [10 §2]). Static login snapshots whole; the
 * data-heavy consoles (users table, analytics) mask their dynamic body so the baseline guards the
 * console CHROME — header, toolbar, nav rail, spacing, theme — not the seeded rows or live numbers
 * ([10 §2.2]). Charts are canvas and inherently volatile, so the analytics baseline masks the
 * content region entirely and guards the page frame. Baselines are produced in the pinned Playwright
 * Docker image ([10 §5]).
 */
test.describe('@phase5 @visual admin (unauthenticated)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('admin login matches its visual baseline', async ({ page }) => {
    await new LoginPage(page, { loginPath: '/login', rememberLabel: /remember me/i }).goto();
    await expect(page).toHaveScreenshot('admin-login.png', { fullPage: true });
  });
});

test.describe('@phase5 @visual admin (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'admin');
  });

  test('the users console chrome matches its visual baseline', async ({ page }) => {
    await new UsersPage(page).goto();
    await expect(page).toHaveScreenshot('admin-users.png', {
      fullPage: true,
      // The user rows are seeded, paginated data — mask the table so the baseline guards the
      // header + search toolbar + nav chrome.
      mask: [page.getByRole('table')],
    });
  });

  test('the analytics console chrome matches its visual baseline', async ({ page }) => {
    await page.goto('/analytics');
    await expect(page.getByRole('heading', { level: 1, name: 'Analytics' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page).toHaveScreenshot('admin-analytics.png', {
      fullPage: true,
      // Live aggregates + canvas charts are volatile — mask the section tabpanel; the baseline
      // guards the page header, filter bar, and section tabs.
      mask: [page.getByRole('tabpanel')],
    });
  });
});
