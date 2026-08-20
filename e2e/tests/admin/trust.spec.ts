import { freshLogin } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { TrustPage, UNKNOWN_USER_ID } from '../../pages/admin/trust-page';

/**
 * The admin Trust & Safety surface (A2, extended by B9; docs/45 §5) — three reads and five
 * mutations.
 *
 * **Every spec arranges its own throwaway account.** A revoked strike stays on the record as
 * history and an auto-escalated restriction is permanent until lifted, so striking a seeded fixture
 * would change what every later run of this suite and the collaboration suite sees.
 *
 * **The reads-only specs no longer use `UNKNOWN_USER_ID` for a clean standing.** They could before
 * B9, because the standing read manufactured a default profile for any well-formed UUID (A2-4) — the
 * finding this suite used as a fixture. The read writes nothing and 404s an unknown id now, so a
 * clean standing means a real account, and the unknown id has its own spec asserting the 404.
 *
 * The RBAC half — who reaches this surface at all — lives in `rbac.spec.ts` beside the existing
 * boundary tests, and the a11y scans in `a11y.spec.ts` so the `admin-dark` project re-runs them.
 */
test.describe('@phase4 admin trust — the reads', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'admin');
  });

  test('the route renders at rest, and no longer warns that an unknown id looks clean', async ({
    page,
  }) => {
    const trust = new TrustPage(page);
    await trust.goto();

    await expect(page.getByText('No account selected')).toBeVisible();
    // A2's caveat is GONE, not reworded: the limit it described was closed by B9 (A2-4).
    await expect(page.getByText(/reads as a clean account/)).toHaveCount(0);
    await expect(page.getByText(/belongs to no account is reported as not found/)).toBeVisible();
  });

  test('an id that belongs to nobody is a not-found, not a clean record (B9, A2-4)', async ({
    page,
  }) => {
    const trust = new TrustPage(page);
    await trust.openExpectingFailure(UNKNOWN_USER_ID);

    // The defect this closes, asserted from the operator's side: a mistyped id used to render a
    // brand-new account in good standing, and an operator could go on to strike it.
    await expect(trust.panel.getByText('Good standing')).toHaveCount(0);
    // What the panel renders. History, because it is the point: this assertion first expected
    // /No such user/i (the server's message, which exists nowhere in the client), was corrected to
    // the generic fallback — `TrustPanel` renders `getErrorMessage(error)`, which maps `ApiError.code`
    // through `lib/error-messages.ts` — and now expects the real copy, because the catalogue has a
    // `USER_NOT_FOUND` entry as of 2026-08-20 (docs/48 §3.19, closed with B8-1). An operator who drops
    // one character of a UUID is told what went wrong instead of that the screen is broken.
    //
    // Asserted as a COUNT, not with `.first()`: all three per-account reads 404 for an unknown id —
    // the standing, the strike list and the restriction list — so the message renders exactly three
    // times. `.first()` would have hidden that and proved only that *something* failed; the count is
    // the sharper claim, and it fails if a fourth read is added without anyone thinking about it.
    await expect(
      trust.panel.getByText('No account has that ID. Check it on the Users screen.'),
    ).toHaveCount(3, { timeout: 15_000 });
  });

  test('a clean record renders as a calm empty state, not an error', async ({
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

    await expect(page.getByText('No restrictions on record')).toBeVisible();
    await expect(page.getByText(/Nothing is wrong/)).toBeVisible();
    // The strike list has the same manners as the restriction list — a clean record, not an error.
    await expect(page.getByText('No strikes on record')).toBeVisible();
    await expect(page.getByText(/active strike weight is 0/)).toBeVisible();
    // The default standing, now DERIVED rather than written: score 50 → Member, status normal.
    await expect(trust.panel.getByText('Good standing')).toBeVisible();
    await expect(trust.panel.getByText(/of 100 · Member \(50–79\)/)).toBeVisible();
    // No error panel, no danger copy anywhere on a clean account.
    await expect(
      page.getByRole('heading', { level: 3, name: 'Something went wrong.' }),
    ).toHaveCount(0);
  });

  test('the score is rendered against its scale, not as a bare number', async ({
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

    // The whole reason this surface can be shipped beside the account actions menu.
    await expect(
      trust.panel.getByText('Trust sanctions are not account suspension.'),
    ).toBeVisible();
    await expect(trust.panel.getByText(/still lets the person sign in and read/)).toBeVisible();
    // UPDATED for B9 (A2-1): A2's note said the Policy Engine never sees an account suspension. It
    // was true, and it was the defect — the engine reads `users.status` now.
    await expect(
      trust.panel.getByText(/the Policy Engine refuses anything a live token could still reach/),
    ).toBeVisible();
    await expect(trust.panel.getByText(/Policy Engine never sees it/)).toHaveCount(0);
  });

  test('the strikes behind the weight are listed, with their state (B9, A2-2)', async ({
    page,
    api,
    data,
  }) => {
    const target = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });
    // Two minor strikes = weight 2, deliberately under the restriction threshold of 3 so this spec
    // reads a strike history without also arranging an escalation.
    const first = await api.strikeUser(target.id, { severity: 'minor', reason: 'e2e strike one' });
    await api.strikeUser(target.id, { severity: 'minor', reason: 'e2e strike two' });
    await api.revokeStrike(first.id);

    const trust = new TrustPage(page);
    await trust.open(target.id);

    // One counting, one revoked — the same "active AND historical in one array" problem the
    // restriction list solves, and it must not be blurred here either.
    await expect(trust.countingTags).toHaveCount(1);
    await expect(trust.revokedTags).toHaveCount(1);
    await expect(trust.panel.getByText('e2e strike two')).toBeVisible();
    // The revoked row is still SHOWN: the weight counts only the live ones, so hiding history would
    // make the total unexplainable.
    await expect(trust.panel.getByText('e2e strike one')).toBeVisible();
  });

  test('a suspended ACCOUNT is not rendered as being in good standing (B9, A2-1)', async ({
    page,
    api,
    data,
  }) => {
    const target = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });
    // An account suspension writes NO trust restriction, so this account's trust standing stays
    // clean — which is exactly the display defect: "Good standing", in success green, beside the
    // suspend control.
    await api.suspendUser(target.id, 'e2e account suspension');

    const trust = new TrustPage(page);
    await trust.open(target.id);

    // `exact: true` because the app is CORRECT here and the locator was not: the account-suspended
    // warning below the badge reads "The ACCOUNT is suspended: they cannot sign in…", which contains
    // the substring "trust standing" further along, so the default substring match found two nodes.
    // The claim is about the field LABEL beside the badge, and that label's whole text is these two
    // words.
    await expect(trust.standingSection.getByText('Trust standing', { exact: true })).toBeVisible();
    await expect(trust.panel.getByText(/The ACCOUNT is suspended/)).toBeVisible();
    await expect(
      trust.panel.getByText(/lift it from the account actions, not from this tab/i),
    ).toBeVisible();
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
    //
    // Scoped to the restriction LIST. The same sentence is also the effect hint inside the restriction
    // FORM further down the panel — which is correct, since the form explains what the type you are
    // about to apply will do — so a panel-wide match found the list's `<p>` and the form's `<span>`.
    // The claim is about the list row, so the locator says so.
    await expect(
      trust.restrictionListSection.getByText(
        'Cannot comment or suggest. Other writes are unaffected.',
      ),
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
    // A clean account: weight 1, resulting total 1, and BOTH thresholds named even though neither is
    // hit. The figure is stated rather than hedged as "projected" — B9's strike list closed the gap
    // that made the hedge honest (A2-2).
    await expect(dialog).toContainText('This strike carries weight 1.');
    await expect(dialog).toContainText('becomes 1, from 0');
    await expect(dialog).not.toContainText('projected from');
    await expect(dialog).toContainText('A restriction follows automatically at 3');
    await expect(dialog).toContainText('a suspension at 6');
    // UPDATED, not dropped: A2 asserted "A strike cannot be revoked or edited once issued", which
    // was true then. It can be revoked now, so the dialog must name the remedy and not deny one.
    await expect(dialog).toContainText('cannot be edited afterwards, but it can be revoked');
    await expect(dialog).not.toContainText('cannot be revoked');

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

  test('revoking confirms, lowers the weight, and keeps the row as history (B9, A2-2)', async ({
    page,
    api,
    data,
  }) => {
    const target = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });
    // Weight 2, under the restriction threshold, so this spec is about the revoke alone.
    await api.strikeUser(target.id, { severity: 'moderate', reason: 'e2e strike to revoke' });

    const trust = new TrustPage(page);
    await trust.open(target.id);
    await expect(trust.countingTags).toHaveCount(1);

    const dialog = await trust.openRevokeConfirmation();
    await expect(dialog).toContainText('Revoke this strike?');
    // The consequence that distinguishes this from lifting: the weight actually moves.
    await expect(dialog).toContainText('goes from 2 to 0');
    await expect(dialog).toContainText('the only action that lowers the weight');
    // No restriction is in force here, so the dialog must NOT warn about one.
    await expect(dialog).not.toContainText('does not lift it');

    await trust.confirm(dialog, 'Revoke strike');
    await expect(page.getByText('Strike revoked.')).toBeVisible();

    // The row becomes history rather than disappearing, and the standing refetches: the weight is
    // back to 0 and the score is recomputed from what is left (50 - 0 * 5 = 50).
    await expect(trust.countingTags).toHaveCount(0, { timeout: 15_000 });
    await expect(trust.revokedTags).toHaveCount(1);
    await expect(trust.panel.getByText('e2e strike to revoke')).toBeVisible();
    // The SCORE reads 50 — scoped to the standing card and exact, because "50" as a substring across
    // the whole panel matched four nodes: the score itself, "of 100 · Member (50–79)", the band
    // legend's "Member 50–79 — current", and "Scores run 0–100 and start at 50" in the explanation.
    // Only the score element's whole text is the bare number, which is precisely the thing asserted.
    await expect(trust.standingSection.getByText('50', { exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('revoking says it will NOT lift a restriction already in force (A2-3)', async ({
    page,
    api,
    data,
  }) => {
    const target = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });
    // Severe = weight 4, which crosses the restriction threshold of 3, so the server applies a
    // permanent global restriction inside the same request. That is the state the warning is for.
    await api.strikeUser(target.id, { severity: 'severe', reason: 'e2e escalating strike' });

    const trust = new TrustPage(page);
    await trust.open(target.id);
    await expect(trust.inForceTags.first()).toBeVisible({ timeout: 15_000 });

    const dialog = await trust.openRevokeConfirmation();
    // A2-3 kept as the design, and made visible: dropping the weight under the threshold does not
    // undo the sanction. An operator revoking strikes to release a restriction is told before, not
    // after.
    await expect(dialog).toContainText('does not lift it');
    await expect(dialog).toContainText('Lift it from the restriction list');
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    // And the restriction is still there, which is what the sentence promised.
    await expect(trust.inForceTags.first()).toBeVisible();
  });

  test('a strike already revoked offers no second revoke', async ({ page, api, data }) => {
    // The 409 the server returns for a double revoke is unreachable from this UI by construction,
    // and that is the assertion: the affordance is per row and only on rows still counting, so a
    // revoked row has no button. Offering one that always 409s would be a lie in an affordance.
    const target = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });
    const strike = await api.strikeUser(target.id, {
      severity: 'minor',
      reason: 'e2e already-revoked strike',
    });
    await api.revokeStrike(strike.id);

    const trust = new TrustPage(page);
    await trust.open(target.id);

    await expect(trust.revokedTags).toHaveCount(1);
    await expect(trust.countingTags).toHaveCount(0);
    await expect(trust.panel.getByRole('button', { name: 'Revoke' })).toHaveCount(0);
  });
});

/**
 * **The `trust.view`-without-`trust.manage` operator is NOT covered in this file**, and cannot be:
 * the admin shell's floor is `Role.Moderator`, and Moderator upward all hold `trust.*` in
 * `DEFAULT_ROLE_PERMISSIONS`. Arranging that operator means editing `role_permissions` at runtime,
 * which no fixture does — the same standing gap A2 recorded, unchanged by B9.
 *
 * The revoke's grant split is asserted where each half is reachable: server-side as route metadata
 * (`backend/src/modules/trust/trust.admin.controller.spec.ts` — `DELETE strikes/:id` carries
 * `trust.manage` and NOT `trust.view`), in the component spec by synthesising the grant set
 * (`admin/.../trust-mutations.spec.tsx` renders the panel with `trust.view` alone and asserts no
 * Revoke button exists), and in `rbac.spec.ts` for the reachable half — a moderator holds both
 * grants and gets both affordances.
 */
