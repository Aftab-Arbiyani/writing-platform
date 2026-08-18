import { expectNoSeriousA11yViolations } from '../../fixtures/a11y';
import { freshLogin } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { ADMIN_DASHBOARDS, DashboardsPage } from '../../pages/admin/dashboards-page';
import { ModerationPage } from '../../pages/admin/moderation-page';
import { MONETIZATION_ROUTES, MonetizationPage } from '../../pages/admin/monetization-page';
import { TrustPage } from '../../pages/admin/trust-page';
import { UsersPage } from '../../pages/admin/users-page';
import { LoginPage } from '../../pages/shared/login-page';

/**
 * Admin accessibility (docs/e2e/06 Phase 5, [10 §4]). Axe (WCAG A + AA) scans the curated admin
 * pages ([10 §2.3]) at a stable, data-loaded state, gating on critical + serious only. AntD is a
 * mature accessible library, so this mostly guards our own composition (page headers, table
 * labels, dialog focus).
 */
test.describe('@phase5 @a11y admin accessibility (unauthenticated)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('admin login has no critical/serious a11y violations', async ({ page }) => {
    await new LoginPage(page, { loginPath: '/login', rememberLabel: /remember me/i }).goto();
    await expectNoSeriousA11yViolations(page, { label: 'admin /login' });
  });
});

test.describe('@phase5 @a11y admin accessibility (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'admin');
  });

  test('the dashboard has no critical/serious a11y violations', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByTestId('admin-header')).toBeVisible({ timeout: 30_000 });
    await expectNoSeriousA11yViolations(page, { label: 'admin /dashboard' });
  });

  test('the users table has no critical/serious a11y violations', async ({ page }) => {
    await new UsersPage(page).goto();
    await expectNoSeriousA11yViolations(page, { label: 'admin /users' });
  });

  test('the moderation queue has no critical/serious a11y violations', async ({ page }) => {
    await new ModerationPage(page).goto();
    await expectNoSeriousA11yViolations(page, { label: 'admin /reports' });
  });

  test('the analytics dashboard has no critical/serious a11y violations', async ({ page }) => {
    // The Analytics console is the curated dashboard for the a11y scan ([10 §2.3]).
    const analytics = ADMIN_DASHBOARDS.find((d) => d.key === 'analytics');
    const dashboards = new DashboardsPage(page);
    await dashboards.expectRenders(analytics!);
    await expectNoSeriousA11yViolations(page, { label: 'admin /analytics' });
  });

  /**
   * A1's monetization surfaces. Scanned in BOTH themes with no extra configuration: the `admin-dark`
   * project re-runs this file under `colorScheme: 'dark'` (playwright.config.ts `UI_QUALITY_ONLY`),
   * so registering the scans here is what makes the dark pass happen — a separate dark spec would
   * duplicate it and drift.
   *
   * Four of the seven are scanned rather than all: the plan catalogue is the densest composition on
   * the surface (nested lists, badge clusters, an inline convention note per field, and since B8 the
   * three editable config tables), Billing actions carries the two destructive FORMS with their
   * aria-invalid + described-by wiring, Revenue is the representative dashboard whose stat grid and
   * empty state the other two share, and Subscriptions was ADDED by B8 because it stopped being a
   * pure dashboard — it now carries an account lookup whose result renders a definition list. The
   * remaining three are the same components in different arrangements, and scanning them would buy
   * coverage of AntD internals rather than of our composition.
   */
  test('the plan catalogue has no critical/serious a11y violations', async ({ page }) => {
    await new MonetizationPage(page).goto(MONETIZATION_ROUTES[0]!);
    await expectNoSeriousA11yViolations(page, { label: 'admin /billing/plans' });
  });

  test('the billing actions forms have no critical/serious a11y violations', async ({ page }) => {
    await new MonetizationPage(page).goto(MONETIZATION_ROUTES[3]!);
    await expectNoSeriousA11yViolations(page, { label: 'admin /billing/actions' });
  });

  test('the revenue dashboard has no critical/serious a11y violations', async ({ page }) => {
    await new MonetizationPage(page).expectRenders(MONETIZATION_ROUTES[4]!);
    await expectNoSeriousA11yViolations(page, { label: 'admin /billing/revenue' });
  });

  /**
   * A2's Trust surface, scanned in BOTH themes for free — the `admin-dark` project re-runs this file,
   * so registering the scans here is what makes the dark pass happen. Two scans, chosen for what each
   * one contains rather than for coverage of the same components twice:
   *
   *   • `/trust` **with a standing loaded** is the whole surface at once: the band strip (an ordered
   *     list whose current band must be conveyed by text, not colour), the restriction list, and both
   *     write FORMS with their labelled selects, date inputs and textareas. Scanned with a result on
   *     screen rather than at rest, for the same reason B8 gave for the subscription lookup — an
   *     empty search box would scan none of it. It arranges a throwaway account: until B9 a
   *     well-formed UUID matching no account resolved to a manufactured default standing (A2-4), and
   *     that is what this scan used to rely on — an unknown id renders a not-found now, which would
   *     scan almost nothing.
   *   • The **drawer tab** is a different a11y question, not a repeat: the same panel inside an AntD
   *     Drawer with a Tabs roving-tabindex and a focus trap, which is where a composition like this
   *     usually breaks.
   */
  test('the trust standing has no critical/serious a11y violations', async ({
    page,
    api,
    data,
  }) => {
    const target = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });
    // One strike, weight 2 — under the restriction threshold, so no escalation is arranged, and the
    // strike list B9 added scans with a populated row and its Revoke button rather than an empty
    // state. That list is new interactive surface on this page and belongs in the scan.
    await api.strikeUser(target.id, { severity: 'moderate', reason: 'a11y strike row' });

    await new TrustPage(page).open(target.id);
    await expectNoSeriousA11yViolations(page, { label: 'admin /trust' });
  });

  test('the trust drawer tab has no critical/serious a11y violations', async ({
    page,
    api,
    data,
  }) => {
    // A restricted throwaway account, so the scan sees a populated restriction row with its Lift
    // button — the interactive part of the list — rather than only the empty state.
    const target = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });
    await api.restrictUser(target.id, {
      type: 'muted',
      scope: 'comments',
      reason: 'e2e a11y restriction',
    });

    await new TrustPage(page).openDrawerTab(target.username);
    await expectNoSeriousA11yViolations(page, { label: 'admin /users → Trust tab' });
  });

  test('the subscription lookup has no critical/serious a11y violations', async ({ page }) => {
    // Scanned WITH a result on screen, not at rest: the lookup's whole point is the card it renders,
    // and an empty search box would scan none of it. A well-formed UUID matching no account resolves
    // to the free-plan card, which is deterministic on any database.
    const monetization = new MonetizationPage(page);
    await monetization.goto(MONETIZATION_ROUTES[5]!);
    await page.getByLabel('User ID').fill('00000000-0000-4000-8000-000000000000');
    await expect(page.getByText('Free plan')).toBeVisible({ timeout: 15_000 });

    await expectNoSeriousA11yViolations(page, { label: 'admin /billing/subscriptions' });
  });
});
