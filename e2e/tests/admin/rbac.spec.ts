import { freshLoginAs } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { AiRetrievalPage, RETRIEVAL_ROUTES } from '../../pages/admin/ai-retrieval-page';
import { MONETIZATION_ROUTES, MonetizationPage } from '../../pages/admin/monetization-page';
import { TrustPage } from '../../pages/admin/trust-page';

/**
 * Admin RBAC boundary (docs/e2e/06 Phase 3). Mints a moderator, signs into the admin
 * panel as them (the shell floor is Role.Moderator, so they reach the dashboard), and
 * asserts the super-admin-only Roles screen is blocked — rendered as a 403 in place
 * (no redirect) with the nav item hidden. The guard is what's under test, so the
 * assertion is on the block, not on any moderator-visible screen.
 */
test.describe('@phase3 admin RBAC', () => {
  test('a moderator is blocked from the super-admin-only roles screen', async ({
    page,
    api,
    data,
  }) => {
    const moderator = await api.createModerator({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });
    // A fresh login AFTER the role change so the JWT claim is `moderator`.
    await freshLoginAs(page, moderator.email, moderator.password);

    // A moderator can reach the admin dashboard (shell floor = moderator).
    await page.goto('/dashboard');
    await expect(page.getByTestId('admin-header')).toBeVisible({ timeout: 30_000 });

    // The super-admin-only Roles screen renders the 403 page IN PLACE (no redirect).
    await page.goto('/roles');
    await expect(page.getByText(/access to this/i)).toBeVisible();
    await expect(page).toHaveURL(/\/roles/);
    await expect(page.getByRole('button', { name: 'Back to dashboard' })).toBeVisible();

    // And the Roles nav item is hidden for a non-super-admin.
    await expect(page.getByRole('menuitem', { name: 'Roles' })).toHaveCount(0);
  });

  /**
   * A1's RBAC boundary, added here rather than in a parallel suite so the admin's permission gates
   * stay described in one place.
   *
   * The monetization routes are guarded by `RequirePermission(billing.manage)` rather than by a role
   * floor, because that is the permission every `admin/monetization` endpoint carries. A moderator
   * holds no `billing.*` grant (`DEFAULT_ROLE_PERMISSIONS`), so all seven routes must 403 in place and
   * every nav item must be absent. Both halves matter: a hidden nav item with a reachable URL is a
   * gate that is not one.
   */
  test('a moderator cannot reach any monetization route, and sees no billing nav', async ({
    page,
    api,
    data,
  }) => {
    const moderator = await api.createModerator({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });
    await freshLoginAs(page, moderator.email, moderator.password);

    await page.goto('/dashboard');
    await expect(page.getByTestId('admin-header')).toBeVisible({ timeout: 30_000 });

    // Not one of the seven nav entries is offered.
    for (const label of MonetizationPage.NAV_LABELS) {
      await expect(page.getByRole('menuitem', { name: label })).toHaveCount(0);
    }

    // And typing the URL gets an honest 403 IN PLACE, on every route.
    for (const route of MONETIZATION_ROUTES) {
      await page.goto(route.path);
      await expect(page.getByText(/access to this/i)).toBeVisible();
      await expect(page).toHaveURL(new RegExp(route.path.replace('/', '\\/')));
      // The page's own heading must never render — the guard sits above the route element.
      await expect(page.getByRole('heading', { level: 1, name: route.heading })).toHaveCount(0);
    }
  });

  /**
   * A2's Trust boundary — and the one place in this file where the permission and the role floor
   * genuinely come apart.
   *
   * `trust.*` is granted to `Role.Moderator` (`DEFAULT_ROLE_PERMISSIONS`), while `/users` — which
   * hosts the Trust TAB — is gated `RequireRole min={Role.Admin}`. So the moderator is simultaneously
   * the role the trust permission was written for and a role that cannot reach the drawer, which is
   * why the surface also has a permission-gated route of its own. This test is that claim, executed:
   * the same viewer is refused `/users` and admitted to `/trust`.
   *
   * **What CANNOT be proved with a real account, stated rather than implied:** there is no seeded
   * role that reaches the admin shell without `trust.view`, and none that holds `trust.view` without
   * `trust.manage` — the shell floor is Moderator, and Moderator upward all hold `trust.*`. So
   * "no trust permission → no tab" and "view-only → no actions" are gate branches with no reachable
   * account behind them, and they are pinned in the admin's own component specs
   * (`trust-mutations.spec.tsx`, `user-trust-tab.spec.tsx`) by synthesising the grant set. They are
   * worth having because `role_permissions` is editable at runtime.
   */
  test('a moderator is refused /users but reaches /trust — the permission, not the rank', async ({
    page,
    api,
    data,
  }) => {
    const moderator = await api.createModerator({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });
    // ALL the arranging happens before the moderator signs in — see the note at the revoke assertion
    // below for why that ordering is load-bearing rather than tidy.
    const inspected = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });
    await api.strikeUser(inspected.id, { severity: 'minor', reason: 'e2e rbac strike' });

    await freshLoginAs(page, moderator.email, moderator.password);

    await page.goto('/dashboard');
    await expect(page.getByTestId('admin-header')).toBeVisible({ timeout: 30_000 });

    // The admin floor refuses them, so the Trust TAB is out of reach for this role.
    await page.goto('/users');
    await expect(page.getByText(/access to this/i)).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toHaveCount(0);

    // The permission-gated route admits them, and the nav offers it.
    await expect(page.getByRole('menuitem', { name: TrustPage.NAV_LABEL })).toBeVisible();
    const trust = new TrustPage(page);
    await trust.goto();
    await expect(page.getByText('No account selected')).toBeVisible();

    // And they hold `trust.manage` too, so the write affordances are theirs.
    //
    // A REAL account, not `UNKNOWN_USER_ID`: the standing read used to manufacture a default profile
    // for any well-formed UUID, which this assertion relied on, and B9 closed that (A2-4). The forms
    // render only once the standing resolves — they read the active weight to state the escalation —
    // so a 404 now leaves nothing to assert about.
    await trust.open(inspected.id);
    await expect(trust.panel.getByRole('button', { name: 'Issue strike' })).toBeVisible();
    await expect(trust.panel.getByRole('button', { name: 'Apply restriction' })).toBeVisible();

    // The revoke B9 added is gated `trust.manage` as well, so it belongs to this role too — asserted
    // with a strike already on the record, since the affordance is per-row.
    //
    // **The strike is arranged at the top of the test and there is no `page.reload()` here**, and that
    // is the fix for this spec's flake rather than a tidy-up. B9 wrote it the other way round —
    // arrange mid-test, then reload to pick the row up — and the reload intermittently returned the
    // SIGN-IN page: the moderator's session is established by a login inside the page context, and a
    // full reload re-runs the app's boot refresh against a rotating refresh-token family. Losing that
    // race signs the moderator out, and the test then fails on a missing `Trust & safety` heading with
    // no hint that authentication was the cause. Arranging first needs no reload at all.
    // One strike was arranged, so there is exactly one Revoke button — no `.first()` needed, and its
    // absence is what keeps this assertion honest about how many rows it expects.
    await expect(trust.countingTags).toHaveCount(1, { timeout: 15_000 });
    await expect(trust.panel.getByRole('button', { name: 'Revoke' })).toBeVisible({
      timeout: 15_000,
    });
  });

  /**
   * The negative case that IS reachable: an ordinary user holds no trust grant and no admin rank.
   * They are stopped by the shell's Moderator floor before the trust guard is consulted, so this
   * asserts the outer gate rather than `trust.view` itself — which is the honest description of what
   * a plain user hitting `/trust` actually meets.
   */
  test('an ordinary user cannot reach /trust at all', async ({ page, api, data }) => {
    const user = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });
    await freshLoginAs(page, user.email, user.password);

    await page.goto('/trust');
    await expect(page.getByText(/access to this/i)).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Trust & safety' })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: TrustPage.NAV_LABEL })).toHaveCount(0);
  });
  /**
   * A3's retrieval boundary. Both `admin/ai/search-config` and `admin/ai/search-analytics` carry
   * `@Permissions(ai.manage)`, and `ai.*` is granted to Admin and SuperAdmin only
   * (`DEFAULT_ROLE_PERMISSIONS`) — so a moderator, the highest role that reaches the admin shell
   * without it, must be refused both routes and offered neither nav entry.
   *
   * The client-side gate is the page's own `can(ai.manage)` check rather than a `RequirePermission`
   * wrapper, matching the sibling AI Defaults route (the Admin floor IS that grant). Asserting the
   * heading is absent is what distinguishes the two: an in-place refusal renders instead of the page,
   * not above a page that already mounted.
   */
  test('a moderator cannot reach either retrieval route, and sees no retrieval nav', async ({
    page,
    api,
    data,
  }) => {
    const moderator = await api.createModerator({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });
    await freshLoginAs(page, moderator.email, moderator.password);

    await page.goto('/dashboard');
    await expect(page.getByTestId('admin-header')).toBeVisible({ timeout: 30_000 });

    for (const label of AiRetrievalPage.NAV_LABELS) {
      await expect(page.getByRole('menuitem', { name: label })).toHaveCount(0);
    }

    for (const route of RETRIEVAL_ROUTES) {
      await page.goto(route.path);
      await expect(page.getByText(/access to this/i)).toBeVisible();
      await expect(page.getByRole('heading', { level: 1, name: route.heading })).toHaveCount(0);
    }
  });
});
