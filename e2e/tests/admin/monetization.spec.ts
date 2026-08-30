import { freshLogin } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { MONETIZATION_ROUTES, MonetizationPage } from '../../pages/admin/monetization-page';

/**
 * The admin monetization surface (A1, docs/45 §5) — one spec per slice.
 *
 * All seven routes sit behind `billing.manage`, which the seeded admin holds. The RBAC half — that an
 * operator WITHOUT the grant sees no nav entry and cannot reach the routes — lives in `rbac.spec.ts`
 * beside the existing role-boundary test rather than in a parallel suite.
 *
 * These specs deliberately avoid asserting any live figure. The analytics endpoints compute on read
 * from ledgers this suite's other specs mutate (users, pieces, AI conversations), so a spec that
 * pinned a number would be racing them. What is asserted is that each route mounts, its reads settle
 * into either data or an honest empty state, and the destructive actions guard themselves.
 */
test.describe('@phase4 admin monetization', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'admin');
  });

  for (const route of MONETIZATION_ROUTES) {
    test(`the ${route.key} route renders`, async ({ page }) => {
      await new MonetizationPage(page).expectRenders(route);
    });
  }
});

test.describe('@phase4 admin monetization — A1a, the levers', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'admin');
  });

  test('the plan catalogue states the inverted sentinel at the field', async ({ page, api }) => {
    const monetization = new MonetizationPage(page);
    await monetization.goto(MONETIZATION_ROUTES[0]!);

    // The single most misreadable thing on this surface, and the reason it is INLINE rather than a
    // tooltip: `maxCollaborators` inverts, so 0 means none and -1 means unlimited.
    await expect(
      page.getByText(/Inverted sentinel: -1 = unlimited, 0 = none/).first(),
    ).toBeVisible();
    await expect(page.getByText('0 = unlimited.').first()).toBeVisible();

    // The rendered seat value is read from the SERVER, not hard-coded.
    //
    // This line used to assert `None (0)` with the comment "free ships zero seats". That is the
    // production default and it is NOT what this stack has: `seed:e2e` sets
    // `free.maxCollaborators = -1` so the collaboration specs can arrange (B6) — so the assertion
    // failed on every seeded run, deterministically, and "three consecutive green CI runs" could
    // never have happened. Fourth instance of a later fixture disarming an older spec, and the
    // first where the disarming change was itself the fix for the previous instance (48 §3.22c).
    //
    // What this spec uniquely covers is the WIRING — that the surface renders through
    // `describeLimit` at all. Both readings of the pure function are already pinned by
    // `admin/src/features/monetization/lib/plan-provenance.spec.ts`, so deriving the expectation
    // here loses no coverage and stops the spec contradicting the seed.
    const { accessToken } = await api.login('admin@qalam.local', 'ChangeMe!SuperAdmin1');
    const free = (await api.plans(accessToken)).find((plan) => plan.tier === 'free');
    expect(free, 'the catalogue always carries a free tier').toBeDefined();

    const seats = free?.limits.maxCollaborators ?? 0;
    // The inverted key always keeps its stored number visible, whichever way it reads — that
    // parenthetical is what tells an operator this field does not follow the usual convention.
    const expected = seats === 0 ? 'None (0)' : `Unlimited (${String(seats)})`;
    await expect(page.getByText(expected).first()).toBeVisible();

    // And the inverse never renders: a `0` reading as a bare "Unlimited" is the exact defect B6
    // exists to prevent, so it must not appear for this field however the stack is seeded.
    if (seats === 0) {
      await expect(page.getByText('Unlimited (0)')).toHaveCount(0);
    }
  });

  test('the catalogue distinguishes compiled defaults from admin overrides', async ({ page }) => {
    const monetization = new MonetizationPage(page);
    await monetization.goto(MONETIZATION_ROUTES[0]!);

    // A seeded install stores the compiled catalogue, so every limit should read as a default. The
    // badge existing at all is what proves provenance is being reported.
    await expect(page.getByText('default', { exact: true }).first()).toBeVisible();
  });

  test('the catalogue marks which premium codes the server actually enforces', async ({ page }) => {
    const monetization = new MonetizationPage(page);
    await monetization.goto(MONETIZATION_ROUTES[0]!);

    // `ai_budget` and, since D3, `ai_writing`. The other six are computed and asserted by nothing.
    await expect(page.getByText('enforced', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('not enforced', { exact: true }).first()).toBeVisible();
  });

  test('the entitlements screen carries the cache-lag caveat', async ({ page }) => {
    const monetization = new MonetizationPage(page);
    await monetization.goto(MONETIZATION_ROUTES[1]!);

    // Without this an operator watching an unchanged app re-grants, or reports a bug.
    await expect(page.getByRole('note')).toContainText('not instant everywhere');
    await expect(page.getByRole('note')).toContainText('do not re-grant');
  });

  test('a deny override confirms before it is sent', async ({ page }) => {
    const monetization = new MonetizationPage(page);
    await monetization.goto(MONETIZATION_ROUTES[1]!);

    // Any id is enough: the grant form renders from a typed id, and this asserts the guard, not a
    // successful write against a real account.
    await page.getByLabel('User ID').fill('00000000-0000-4000-8000-000000000000');
    await page.getByLabel('Effect').selectOption('deny');
    await page.getByRole('button', { name: 'Deny feature' }).click();

    // An override outranks the plan in both directions, so a deny removes paid-for access.
    await expect(page.getByRole('dialog')).toContainText('Deny this feature for the user?');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test.describe('@phase4 admin monetization — A1b, the money actions', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'admin');
  });

  test('a duplicate coupon code is a FIELD error, not a toast', async ({ page, data }) => {
    const monetization = new MonetizationPage(page);
    await monetization.goto(MONETIZATION_ROUTES[2]!);

    const code = `E2E${data.username().slice(-8).toUpperCase()}`;
    // Scoped to the create card: the code field's error and AntD's toast notifications BOTH carry
    // `role="alert"`, and the toast for the first (successful) create is still on screen when the
    // second create fails — so a page-wide `getByRole('alert')` matched two nodes. The claim is about
    // the FIELD error, which is the whole point of this test.
    const couponForm = monetization.couponForm;
    const codeInput = couponForm.getByLabel('Code');

    // First create succeeds.
    await codeInput.fill(code);
    await page.getByRole('button', { name: 'Create coupon' }).click();
    await expect(page.getByText(code, { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    // The same code again is COUPON_CODE_TAKEN — the one error the operator can fix in place, so it
    // lands on the input and marks it invalid rather than flashing past in a toast.
    await codeInput.fill(code);
    await page.getByRole('button', { name: 'Create coupon' }).click();
    await expect(couponForm.getByRole('alert')).toContainText('That code already exists');
    await expect(codeInput).toHaveAttribute('aria-invalid', 'true');

    // And it clears the moment the operator edits the code.
    await codeInput.fill(`${code}X`);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('the credit form reads the account’s balance before anything is changed', async ({
    page,
    api,
    data,
  }) => {
    // B8's A1-3. An account that has never had a wallet answers `credits: null`, which is a real
    // balance of zero rather than an error — the screen has to say so calmly, and the read must not
    // create a wallet for it.
    //
    // **Arranges a real account (B8-1).** This used to type a hardcoded all-zeros UUID, which named
    // nobody; the read answered the same nullable shape either way, so the spec could not tell the
    // two apart and neither could an operator. The read 404s an unknown id now, so "no wallet yet"
    // is arranged the only way it means anything: a real user who has never been granted credits.
    const target = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });

    const monetization = new MonetizationPage(page);
    await monetization.goto(MONETIZATION_ROUTES[3]!);

    await page.getByLabel('User ID').first().fill(target.id);

    await expect(page.getByText(/has no wallet yet/i)).toBeVisible({ timeout: 15_000 });
    await monetization.expectNoErrorPanel();
  });

  test('a credit DEDUCTION confirms with the balance it actually read', async ({
    page,
    api,
    data,
  }) => {
    // A real account, for the same reason as the balance test above (B8-1): the projected copy is
    // read off a successful balance read, and an unknown id no longer produces one.
    const target = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });

    const monetization = new MonetizationPage(page);
    await monetization.goto(MONETIZATION_ROUTES[3]!);

    // Scoped to the credit card rather than `.first()`: the refund card beside it has its own
    // "User ID" and an "Amount (optional)", so both labels are ambiguous page-wide.
    const creditForm = monetization.creditForm;
    await creditForm.getByLabel('User ID').fill(target.id);
    // Wait for the balance: until it lands the form cannot project, and asserting the projected
    // copy before the read settles would be asserting the fallback.
    await expect(creditForm.getByText(/has no wallet yet/i)).toBeVisible({ timeout: 15_000 });
    await creditForm.getByLabel('Amount').fill('-500');
    await page.getByRole('button', { name: 'Deduct credits' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Deduct 500 credits?');
    // The server clamps at zero and B8 left that alone (DECISION 3), so the confirmation says what
    // will really happen to an empty wallet rather than promising a negative balance.
    await expect(dialog).toContainText('holds no credits, so the deduction removes nothing');
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('the refund form lists the account’s payments instead of demanding an ID', async ({
    page,
    api,
    data,
  }) => {
    // B8's A1-5. An account with no charges answers an empty page, not an error — and the picker
    // says so.
    //
    // The sentence "which is the state a mistyped id lands in" used to end that comment and was the
    // defect talking (B8-1): a mistyped id answered an empty page too, so the picker told an operator
    // the same thing about a real account and about nobody. It 404s now, and this arranges a real
    // account with no charges — which is what the test was always trying to describe.
    const target = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });

    const monetization = new MonetizationPage(page);
    await monetization.goto(MONETIZATION_ROUTES[3]!);

    await page.getByLabel('User ID').last().fill(target.id);

    await expect(page.getByText('No payments on this account')).toBeVisible({ timeout: 15_000 });
    await monetization.expectNoErrorPanel();
  });

  test('a grant does NOT confirm — only the destructive direction does', async ({ page }) => {
    const monetization = new MonetizationPage(page);
    await monetization.goto(MONETIZATION_ROUTES[3]!);

    // Same two ambiguous labels as the deduction test above, scoped the same way.
    const creditForm = monetization.creditForm;
    await creditForm.getByLabel('User ID').fill('00000000-0000-4000-8000-000000000000');
    await creditForm.getByLabel('Amount').fill('250');

    // Confirming both would train the operator to click through dialogs.
    await expect(page.getByRole('button', { name: 'Grant credits' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Deduct credits' })).toHaveCount(0);
  });

  test('a refund on an unknown payment ID blames the input and offers no retry', async ({
    page,
  }) => {
    const monetization = new MonetizationPage(page);
    await monetization.goto(MONETIZATION_ROUTES[3]!);

    // A well-formed UUID that matches no payment → PAYMENT_NOT_FOUND. Distinct from a provider
    // failure, which is retryable; conflating the two is the defect docs/48 §3.6 records.
    await page.getByLabel('Payment ID').fill('00000000-0000-4000-8000-000000000000');
    await page.getByRole('button', { name: 'Refund payment' }).click();
    await expect(page.getByRole('dialog')).toContainText('refunded IN FULL');
    await page.getByRole('button', { name: 'Send refund' }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('No payment with that ID', { timeout: 15_000 });
    // No longer hedged with "or was never captured at a provider": B8 split that into
    // PAYMENT_NOT_REFUNDABLE, so this copy can mean only what it says (A1-1).
    await expect(alert).not.toContainText('never captured at a provider');
    await expect(alert.getByRole('button', { name: 'Try again' })).toHaveCount(0);
  });

  test('a coupon’s tier restriction and per-user cap come back on the list', async ({
    page,
    data,
  }) => {
    // B8's A1-4. All three were write-only until the mapper returned them, so an operator could set
    // a Plus-only coupon and had no way to confirm it was Plus-only.
    const monetization = new MonetizationPage(page);
    await monetization.goto(MONETIZATION_ROUTES[2]!);

    const code = `E2E${data.username().slice(-8).toUpperCase()}`;
    await page.getByLabel('Code').fill(code);
    await page.getByLabel('Applies to tier').selectOption('plus');
    await page.getByLabel('Per-user limit').fill('3');
    await page.getByRole('button', { name: 'Create coupon' }).click();

    const row = page.locator('li', { hasText: code }).first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row).toContainText('3 per user');
    await expect(row).toContainText('plus only');
  });
});

test.describe('@phase4 admin monetization — A1c, the dashboards', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'admin');
  });

  test('no dashboard fabricates a zero — each shows data or says there is none', async ({
    page,
  }) => {
    const monetization = new MonetizationPage(page);

    for (const route of MONETIZATION_ROUTES.filter((r) => r.emptyMarker !== undefined)) {
      await monetization.goto(route);

      const populated = page.getByText(route.populatedMarker!, { exact: true }).first();
      const empty = page.getByText(route.emptyMarker!, { exact: true }).first();
      await expect(populated.or(empty)).toBeVisible();

      // Exactly one of the two, never both: an empty dashboard must not also render tiles reading 0.
      const populatedCount = await populated.count();
      const emptyCount = await empty.count();
      expect(populatedCount + emptyCount).toBeGreaterThan(0);
      expect(Math.min(populatedCount, emptyCount)).toBe(0);
    }
  });

  test('the subscriptions dashboard looks up ONE account', async ({ page, api, data }) => {
    // A1's premise, closed by B8 (A1-7). Unconditional, unlike the sentence it replaces: the lookup
    // sits outside the emptiness check, because an operator can need to confirm an account is on
    // free whether or not anyone on the install has ever subscribed.
    //
    // **Arranges a REAL account** (it used to fill a hardcoded all-zeros UUID). That id belongs to
    // nobody, and until B8-1 closed the read answered it with the free-plan card — so this spec was
    // passing on the defect: it proved "a nonexistent id renders as free", which is the thing that
    // was wrong. A free account is now the only thing that renders this card.
    const target = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });

    const monetization = new MonetizationPage(page);
    await monetization.goto(MONETIZATION_ROUTES[5]!);

    await expect(page.getByText('Look up one account')).toBeVisible();
    await page.getByLabel('User ID').fill(target.id);

    // No subscription row → the free-plan card, which is a statement and not an error. This is the
    // platform's commonest account state and it must never render as a failure.
    // The CARD's heading, not a substring: the card's own explanatory paragraph ("This account has
    // no subscription record, which is the free plan…") contains the phrase too, so the loose match
    // found both. The heading is the thing that says "this account is on free".
    await expect(page.getByRole('heading', { name: 'Free plan' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('alert')).toHaveCount(0);
    await monetization.expectNoErrorPanel();
  });

  test('an id that belongs to nobody is a not-found, not a free account (B8-1)', async ({
    page,
  }) => {
    // The other half of the row, and the reason the spec above had to change. All four admin
    // per-account reads now 404 `USER_NOT_FOUND`, converging on what the trust reads already did
    // (§3.16 A2-4) — two admin surfaces answering "does this id exist?" two different ways was worse
    // than either answer alone.
    const monetization = new MonetizationPage(page);
    await monetization.goto(MONETIZATION_ROUTES[5]!);

    await page.getByLabel('User ID').fill('00000000-0000-4000-8000-000000000000');

    // The operator is told what is actually wrong — the catalogue entry added with this row
    // (§3.19). Before it, this rendered "Something went wrong. Please try again.", which reads as a
    // broken screen rather than a mistyped id.
    await expect(
      page.getByText('No account has that ID. Check it on the Users screen.'),
    ).toBeVisible({ timeout: 15_000 });
    // And it does NOT render as an account on free — the compensating copy is gone with the ambiguity.
    await expect(page.getByRole('heading', { name: 'Free plan' })).toHaveCount(0);
    await expect(page.getByText(/does not exist reads the same way/i)).toHaveCount(0);
  });
});

test.describe('@phase4 admin monetization — B8, the config tables', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'admin');
  });

  test('a tax rate is editable and confirms with before → after', async ({ page }) => {
    // A1-2: `PATCH config` wrote four of seven fields, so these three were rendered read-only. They
    // are inputs now.
    //
    // **It cancels rather than saves, deliberately.** `monetization.config` is global state that
    // prices every subscription in this suite's database, and the specs run `fullyParallel`. Writing
    // a rate here would race every other spec that touches billing. What needs proving is that the
    // field reaches the patch at all, and the confirmation dialog shows exactly that.
    const monetization = new MonetizationPage(page);
    await monetization.goto(MONETIZATION_ROUTES[0]!);

    const gb = page.locator('#config-taxRates-GB');
    await expect(gb).toBeVisible();
    await gb.fill('0.25');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByRole('dialog')).toContainText('Tax rates · GB: 0.2 → 0.25');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('the merge rule is stated, so a blanked row does not read as a delete', async ({ page }) => {
    const monetization = new MonetizationPage(page);
    await monetization.goto(MONETIZATION_ROUTES[0]!);

    await expect(page.getByText(/a row you blank is left as it was/i)).toBeVisible();
  });
});
