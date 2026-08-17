import { freshLogin } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { MONETIZATION_ROUTES, MonetizationPage } from '../../pages/admin/monetization-page';
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
    const users = new UsersPage(page);
    await users.goto();
    // Filter to ONE seeded account so the table renders exactly one row, always.
    //
    // Viewport-not-fullPage (below) stops the row count causing a size MISMATCH, but it does not
    // make the shot deterministic: the masked table still contributes its HEIGHT inside the
    // viewport, so every element after it — the pagination row, the empty space under it — moves
    // with the row count. And the count genuinely varies. `tests/frontend/visual.spec.ts` mints
    // three throwaway users per run via `api.createVerifiedUser` for the blocks baseline, on three
    // engines, under `fullyParallel` with two workers — so this screenshot races those inserts and
    // sees a different total depending on scheduling.
    //
    // That was invisible until now only because the frontend half of the suite could not boot in
    // CI, so nothing created users and the count sat at the seeded value. Filtering removes the
    // dependency outright rather than betting on ordering. `e2e_writer` comes from
    // `backend/src/database/seeds/e2e-fixtures.seed.ts`, and no @visual spec mutates it; the
    // frontend's generated usernames (`e2e_<seed>-<worker>-<n>`) cannot match this needle.
    // `searchFor` asserts the row is present, so a missing fixture fails loudly instead of
    // quietly minting an empty table.
    await users.searchFor('e2e_writer');
    await expect(page).toHaveScreenshot('admin-users.png', {
      // Viewport, NOT fullPage — see above; header + search toolbar + nav chrome are above the fold.
      mask: [page.getByRole('table')],
    });
  });

  test('the analytics console chrome matches its visual baseline', async ({ page }) => {
    await page.goto('/analytics');
    await expect(page.getByRole('heading', { level: 1, name: 'Analytics' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page).toHaveScreenshot('admin-analytics.png', {
      // Viewport, NOT fullPage — same height-stability reason as the users console; the masked
      // tabpanel grows with whatever the aggregates return. The baseline guards the page header,
      // filter bar, and section tabs, all above the fold.
      mask: [page.getByRole('tabpanel')],
    });
  });

  /**
   * A1's monetization chrome. **These baselines are DELIBERATELY UNMINTED** — only the web-e2e
   * workflow's visual job may mint one, in the pinned Playwright image ([10 §5], [10 §8.3]); a
   * locally produced PNG bakes in this machine's fonts and would fail in CI forever. Until the
   * workflow mints them these two tests fail on a missing snapshot, which is the intended, visible
   * state rather than a silent gap.
   *
   * Pending, across all four admin projects (chromium / firefox / webkit / dark):
   *   • `admin-billing-plans.png`
   *   • `admin-billing-actions.png`
   *
   * Determinism was checked FIRST, which is why it is two files and not seven:
   *
   *   • **Plans** is fully deterministic. `GET plans` resolves the stored catalogue over compiled
   *     defaults, no spec in this suite writes `monetization.plans`, and nothing on the page renders
   *     a date or a live count.
   *   • **Billing actions** is deterministic because it is two empty FORMS — no reads at all, so no
   *     seeded data and no ordering to race.
   *   • The three dashboards are **excluded**: every figure comes from ledgers other specs in this
   *     suite mutate (users, pieces, AI conversations) under `fullyParallel` with two workers, so a
   *     baseline would race them exactly as the users table did ([10 §2.2]). Masking would not save
   *     it either — the empty-vs-populated branch changes the page's whole STRUCTURE, not just its
   *     numbers, so a masked shot would still mismatch in height.
   *   • **Coupons** is excluded for the same reason at a smaller scale: the A1b functional spec
   *     creates a coupon per run, so the table's row count varies.
   *   • **Entitlements** is excluded as it has nothing to show until an id is typed.
   */
  test('the plans console chrome matches its visual baseline', async ({ page }) => {
    await new MonetizationPage(page).goto(MONETIZATION_ROUTES[0]!);
    await expect(page).toHaveScreenshot('admin-billing-plans.png', { fullPage: true });
  });

  test('the billing actions forms match their visual baseline', async ({ page }) => {
    await new MonetizationPage(page).goto(MONETIZATION_ROUTES[3]!);
    await expect(page).toHaveScreenshot('admin-billing-actions.png', { fullPage: true });
  });
});
