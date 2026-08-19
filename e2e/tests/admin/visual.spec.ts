import { freshLogin } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { MONETIZATION_ROUTES, MonetizationPage } from '../../pages/admin/monetization-page';
import { AiRetrievalPage } from '../../pages/admin/ai-retrieval-page';
import { TrustPage } from '../../pages/admin/trust-page';
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
   *     a date or a live count. B8 turned its config tables into inputs, which does not change that:
   *     `GET config` resolves the same way, and the B8 spec that edits a rate CANCELS rather than
   *     saving, precisely so nothing in this suite writes `monetization.config` either.
   *   • **Billing actions** is deterministic because it is two empty FORMS at rest — no reads fire
   *     until an id is typed, so no seeded data and no ordering to race. B8's payment picker and
   *     balance panel render only after an id, and this shot does not type one.
   *   • **Subscriptions** gained an account lookup in B8 and is still excluded: the dashboard above
   *     the lookup is the racing part, and photographing the lookup alone would need a viewport shot
   *     framed around one card — coverage the a11y scan already provides more cheaply.
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

  /**
   * A2's trust surface. **Also DELIBERATELY UNMINTED**, on the same terms as the two above — only the
   * web-e2e workflow's visual job may mint a baseline, in the pinned Playwright image ([10 §5]).
   *
   * Pending, across all four admin projects (chromium / firefox / webkit / dark):
   *   • `admin-trust.png`
   *
   * **One candidate out of four, because determinism was checked first:**
   *
   *   • **`/trust` for a FRESH throwaway account** is deterministic, and it is the only shot here
   *     worth minting. Nothing on the page renders a date or a live count in that state: the standing
   *     is the derived default (score 50 → Member, status normal, weight 0), and the restriction list,
   *     the strike list and both write forms are all in fixed empty states. The account is minted for
   *     this shot alone, so no other spec can write to it and nothing can race it.
   *
   *     B9 changed HOW this shot gets that state, not whether it is deterministic. It used to pass
   *     `UNKNOWN_USER_ID`, relying on the standing read creating a default `trust_profiles` row for
   *     any well-formed UUID (A2-4) — which also meant this screenshot left a row behind for the zero
   *     UUID on every run. The read writes nothing and 404s an unknown id now, so an account is
   *     arranged instead and the side effect is gone.
   *   • **`/trust` for a RESTRICTED or STRUCK account is excluded.** Every restriction row renders
   *     "applied <timestamp>" and every strike row "issued <timestamp>", and the score and weight move
   *     with whatever the account has been through — sources of drift that masking cannot fix, since
   *     the row count changes the page's height.
   *   • **The drawer tab is excluded**: it is the same panel inside an animated AntD Drawer, so the
   *     shot would race the open transition on top of the timestamp problem above. The a11y scan
   *     already covers that composition, more cheaply and more usefully.
   *   • **`/trust` at rest** (no id typed) is deterministic but nearly empty — a header, a search
   *     card and an empty state. It would guard console chrome the users and analytics baselines
   *     already guard, so it earns nothing.
   */
  /**
   * A3's retrieval config editor. **Also DELIBERATELY UNMINTED**, on the same terms as the four
   * above — only the web-e2e workflow's visual job may mint a baseline, in the pinned Playwright
   * image ([10 §5]).
   *
   * Pending, across all four admin projects (chromium / firefox / webkit / dark):
   *   • `admin-ai-search-config.png`
   *
   * **One candidate out of two, because determinism was checked first:**
   *
   *   • **The config editor is deterministic**, and it is the densest form on the admin surface —
   *     four switches and nine weight inputs in a fixed grid, no date, no count, no row whose number
   *     can vary. The values come from `ai.retrieval.config` resolved over compiled defaults, and the
   *     only spec in this suite that writes that row is A3's own round-trip, which saves the form
   *     UNCHANGED precisely so nothing here (and nothing in the frontend AF4 specs) moves under it.
   *   • **Search analytics is excluded.** Every figure is aggregated from retrieval telemetry that
   *     the frontend AF4 specs generate while this runs, so the numbers move with the suite. Masking
   *     would not rescue it: whether the window is empty decides between a stat grid and an empty
   *     state — a different page STRUCTURE and height, which is the same reason A1's three dashboards
   *     are excluded. The a11y scan covers that composition in both themes instead.
   */
  test('the retrieval config editor matches its visual baseline', async ({ page }) => {
    await new AiRetrievalPage(page).goto(AiRetrievalPage.config);
    // Wait for the values, not just the heading: the form renders its labels before the read lands,
    // and photographing that intermediate state would bake an empty form into the baseline.
    await expect(new AiRetrievalPage(page).weight('Semantic similarity')).not.toHaveValue('');
    await expect(page).toHaveScreenshot('admin-ai-search-config.png', { fullPage: true });
  });

  test('the trust standing matches its visual baseline', async ({ page, api, data }) => {
    // A throwaway account with NO strikes and NO restrictions, which keeps the shot deterministic:
    // both lists render their empty states, and nothing on the panel carries a timestamp. It used to
    // use `UNKNOWN_USER_ID`, relying on the standing read manufacturing a default profile for any id
    // (A2-4) — closed by B9, so an unknown id would now shoot a not-found.
    const target = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });
    await new TrustPage(page).open(target.id);
    await expect(page).toHaveScreenshot('admin-trust.png', { fullPage: true });
  });
});
