import { freshLogin } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { TrustPage, UNKNOWN_USER_ID } from '../../pages/admin/trust-page';

/**
 * The admin Trust & Safety surface (A2, docs/45 §5) — the two reads and the three mutations.
 *
 * **Every spec that writes arranges its own throwaway account.** A strike cannot be revoked by any
 * route, and an auto-escalated restriction is permanent, so striking a seeded fixture would change
 * what every later run of this suite and the collaboration suite sees. The reads-only specs use a
 * well-formed UUID matching no account, which the standing read answers with a default profile —
 * itself a finding, recorded as A2-4, and asserted below because an operator has to know it.
 *
 * The RBAC half — who reaches this surface at all — lives in `rbac.spec.ts` beside the existing
 * boundary tests, and the a11y scans in `a11y.spec.ts` so the `admin-dark` project re-runs them.
 */
test.describe('@phase4 admin trust — the reads', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'admin');
  });

  test('the route renders at rest, with the unknown-id caveat stated', async ({ page }) => {
    const trust = new TrustPage(page);
    await trust.goto();

    await expect(page.getByText('No account selected')).toBeVisible();
    // The honest limit of a per-account read (B8-1, and worse here): the standing read manufactures
    // a default profile for any id, so a mistyped id looks like a clean new account.
    await expect(page.getByText(/reads as a clean account/)).toBeVisible();
  });

  test('a clean record renders as a calm empty state, not an error', async ({ page }) => {
    const trust = new TrustPage(page);
    await trust.open(UNKNOWN_USER_ID);

    await expect(page.getByText('No restrictions on record')).toBeVisible();
    await expect(page.getByText(/Nothing is wrong/)).toBeVisible();
    // The default standing the server manufactures: score 50 → Member, status normal.
    await expect(trust.panel.getByText('Good standing')).toBeVisible();
    await expect(trust.panel.getByText(/of 100 · Member \(50–79\)/)).toBeVisible();
    // No error panel, no danger copy anywhere on a clean account.
    await expect(
      page.getByRole('heading', { level: 3, name: 'Something went wrong.' }),
    ).toHaveCount(0);
  });

  test('the score is rendered against its scale, not as a bare number', async ({ page }) => {
    const trust = new TrustPage(page);
    await trust.open(UNKNOWN_USER_ID);

    // All four band boundaries are on screen, so a score can be placed without prior knowledge.
    await expect(trust.panel.getByText('Trusted 80–100')).toBeVisible();
    await expect(trust.panel.getByText(/Member 50–79 — current/)).toBeVisible();
    await expect(trust.panel.getByText('Basic 25–49')).toBeVisible();
    await expect(trust.panel.getByText('New 0–24')).toBeVisible();
    // And the thresholds that escalate on their own are named beside the weight they act on.
    await expect(trust.panel.getByText(/Restriction at 3, suspension at 6/)).toBeVisible();
  });

  test('the panel says how a trust sanction differs from the account suspension', async ({
    page,
  }) => {
    const trust = new TrustPage(page);
    await trust.open(UNKNOWN_USER_ID);

    // The whole reason this surface can be shipped beside the account actions menu.
    await expect(
      trust.panel.getByText('Trust sanctions are not account suspension.'),
    ).toBeVisible();
    await expect(trust.panel.getByText(/blocks sign-in and revokes every session/)).toBeVisible();
    await expect(trust.panel.getByText(/still lets the person sign in and read/)).toBeVisible();
  });

  test('an active restriction reads as live, and a lifted one as history', async ({
    page,
    api,
    data,
  }) => {
    const target = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });
    // Two rows on one account: one still in force, one lifted. `GET users/:id/restrictions` returns
    // both in a single array, which is exactly what the list must not blur.
    await api.restrictUser(target.id, {
      type: 'muted',
      scope: 'comments',
      reason: 'e2e active restriction',
    });
    const lifted = await api.restrictUser(target.id, {
      type: 'read_only',
      scope: 'publishing',
      reason: 'e2e lifted restriction',
    });
    await api.liftRestriction(lifted.id);

    const trust = new TrustPage(page);
    await trust.open(target.id);

    await expect(trust.panel.getByText('Muted', { exact: false }).first()).toBeVisible();
    await expect(trust.inForceTags).toHaveCount(1);
    await expect(trust.panel.getByText('Lifted', { exact: true })).toHaveCount(1);
    // The live row says what it stops; the lifted one does not pretend to.
    await expect(
      trust.panel.getByText('Cannot comment or suggest. Other writes are unaffected.'),
    ).toBeVisible();
  });

  test('the drawer tab shows the same panel for the account it is opened on', async ({
    page,
    api,
    data,
  }) => {
    const target = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });
    await api.restrictUser(target.id, {
      type: 'muted',
      scope: 'global',
      reason: 'e2e drawer restriction',
    });

    const trust = new TrustPage(page);
    await trust.openDrawerTab(target.username);

    // Same panel, same words — this is the entry point that sits beside the account Suspend action.
    await expect(
      trust.panel.getByText('Trust sanctions are not account suspension.'),
    ).toBeVisible();
    await expect(trust.inForceTags).toHaveCount(1);
  });
});

test.describe('@phase4 admin trust — the mutations', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'admin');
  });

  test('a strike confirms first, and the confirmation states the escalation', async ({
    page,
    api,
    data,
  }) => {
    const target = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });

    const trust = new TrustPage(page);
    await trust.open(target.id);

    const dialog = await trust.openStrikeConfirmation('e2e minor strike', 'minor');
    // A clean account: weight 1, projected 1, and BOTH thresholds named even though neither is hit.
    await expect(dialog).toContainText('This strike carries weight 1.');
    await expect(dialog).toContainText('becomes 1 (projected from 0)');
    await expect(dialog).toContainText('A restriction follows automatically at 3');
    await expect(dialog).toContainText('a suspension at 6');
    await expect(dialog).toContainText('A strike cannot be revoked or edited once issued');

    await trust.confirm(dialog, 'Issue strike');
    await expect(page.getByText(/Strike issued \(weight 1\)/)).toBeVisible();
    // The standing refetches: the score drops and the weight is no longer 0.
    await expect(trust.panel.getByText('45')).toBeVisible({ timeout: 15_000 });
  });

  test('a severe strike that crosses the threshold says the account will be restricted', async ({
    page,
    api,
    data,
  }) => {
    const target = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });

    const trust = new TrustPage(page);
    await trust.open(target.id);

    // Severe carries weight 4, which is over the restriction threshold of 3 from a clean record —
    // so the server will apply a permanent global restriction inside the same request, and the
    // dialog's TITLE has to say so before the operator commits.
    const dialog = await trust.openStrikeConfirmation('e2e severe strike', 'severe');
    await expect(dialog).toContainText('This strike will also restrict the account');
    await expect(dialog).toContainText('4 reaches the restriction threshold of 3');
    await expect(dialog).toContainText('permanent global "Restricted" restriction');

    await trust.confirm(dialog, 'Issue strike');
    await expect(page.getByText(/Strike issued \(weight 4\)/)).toBeVisible();

    // Both reads move: the restriction the operator was warned about is now in the list, and the
    // standing reflects it. This is the auto-escalation, arriving from a strike request.
    await expect(trust.inForceTags.first()).toBeVisible({ timeout: 15_000 });
    await expect(trust.panel.getByText('Automatic restriction:', { exact: false })).toBeVisible();
  });

  test('a permanent restriction cannot be confused with a dated one', async ({
    page,
    api,
    data,
  }) => {
    const target = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });

    const trust = new TrustPage(page);
    await trust.open(target.id);

    // No end date → the title says PERMANENT and the confirm button commits to it in words.
    const permanent = await trust.openRestrictionConfirmation({
      type: 'muted',
      scope: 'comments',
      reason: 'e2e permanent mute',
    });
    await expect(permanent).toContainText('Apply a PERMANENT muted restriction?');
    await expect(permanent).toContainText('It has NO end date');
    await expect(permanent.getByRole('button', { name: 'Apply permanently' })).toBeVisible();
    await permanent.getByRole('button', { name: 'Cancel' }).click();
    await expect(permanent).toBeHidden();

    // With an end date → the same form says the opposite, in the title.
    const dated = await trust.openRestrictionConfirmation({
      reason: 'e2e dated mute',
      endsOn: '2027-01-01',
    });
    await expect(dated).toContainText(/Apply a muted restriction until/);
    await expect(dated).toContainText(/It ends by itself on/);
    await expect(dated).not.toContainText('NO end date');

    await trust.confirm(dated, 'Apply until that date');
    await expect(page.getByText(/Muted applied \(Comments\)/)).toBeVisible();
    await expect(trust.inForceTags.first()).toBeVisible({ timeout: 15_000 });
    await expect(trust.panel.getByText(/^Until /)).toBeVisible();
  });

  test('a trust suspension says in the dialog that it is not the account suspension', async ({
    page,
    api,
    data,
  }) => {
    const target = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });

    const trust = new TrustPage(page);
    await trust.open(target.id);

    const dialog = await trust.openRestrictionConfirmation({
      type: 'suspended',
      reason: 'e2e trust suspension',
    });
    await expect(dialog).toContainText(
      'This is the trust suspension, not the account suspension: they can still sign in and read.',
    );
    await dialog.getByRole('button', { name: 'Cancel' }).click();
  });

  test('lifting confirms, targets the restriction, and moves the row into history', async ({
    page,
    api,
    data,
  }) => {
    const target = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });
    await api.restrictUser(target.id, {
      type: 'muted',
      scope: 'comments',
      reason: 'e2e restriction to lift',
    });

    const trust = new TrustPage(page);
    await trust.open(target.id);
    await expect(trust.inForceTags).toHaveCount(1);

    const dialog = await trust.openLiftConfirmation();
    await expect(dialog).toContainText('Lift the muted restriction?');
    // The thing that surprises operators, and the reason the copy exists.
    await expect(dialog).toContainText('Their active strike weight is unchanged');

    await trust.confirm(dialog, 'Lift restriction');
    await expect(page.getByText('Muted lifted.')).toBeVisible();
    // The row survives as history and stops being live — one array, two meanings.
    await expect(trust.inForceTags).toHaveCount(0, { timeout: 15_000 });
    await expect(trust.panel.getByText('Lifted', { exact: true })).toHaveCount(1);
  });
});
