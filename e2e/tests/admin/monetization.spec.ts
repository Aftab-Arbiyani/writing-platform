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

  test('the plan catalogue states the inverted sentinel at the field', async ({ page }) => {
    const monetization = new MonetizationPage(page);
    await monetization.goto(MONETIZATION_ROUTES[0]!);

    // The single most misreadable thing on this surface, and the reason it is INLINE rather than a
    // tooltip: `maxCollaborators` inverts, so 0 means none and -1 means unlimited.
    await expect(
      page.getByText(/Inverted sentinel: -1 = unlimited, 0 = none/).first(),
    ).toBeVisible();
    await expect(page.getByText('0 = unlimited.').first()).toBeVisible();

    // Free ships zero seats, which must never render as "Unlimited".
    await expect(page.getByText('None (0)').first()).toBeVisible();
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
    const codeInput = page.getByLabel('Code');

    // First create succeeds.
    await codeInput.fill(code);
    await page.getByRole('button', { name: 'Create coupon' }).click();
    await expect(page.getByText(code, { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    // The same code again is COUPON_CODE_TAKEN — the one error the operator can fix in place, so it
    // lands on the input and marks it invalid rather than flashing past in a toast.
    await codeInput.fill(code);
    await page.getByRole('button', { name: 'Create coupon' }).click();
    await expect(page.getByRole('alert')).toContainText('That code already exists');
    await expect(codeInput).toHaveAttribute('aria-invalid', 'true');

    // And it clears the moment the operator edits the code.
    await codeInput.fill(`${code}X`);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('the credit form reads the account’s balance before anything is changed', async ({
    page,
  }) => {
    // B8's A1-3. A well-formed UUID matching no account answers `credits: null`, which is a real
    // balance of zero rather than an error — the screen has to say so calmly, and the read must not
    // create a wallet for an id that was typed by mistake.
    const monetization = new MonetizationPage(page);
    await monetization.goto(MONETIZATION_ROUTES[3]!);

    await page.getByLabel('User ID').first().fill('00000000-0000-4000-8000-000000000000');

    await expect(page.getByText(/has no wallet yet/i)).toBeVisible({ timeout: 15_000 });
    await monetization.expectNoErrorPanel();
  });

  test('a credit DEDUCTION confirms with the balance it actually read', async ({ page }) => {
    const monetization = new MonetizationPage(page);
    await monetization.goto(MONETIZATION_ROUTES[3]!);

    await page.getByLabel('User ID').first().fill('00000000-0000-4000-8000-000000000000');
    // Wait for the balance: until it lands the form cannot project, and asserting the projected
    // copy before the read settles would be asserting the fallback.
    await expect(page.getByText(/has no wallet yet/i)).toBeVisible({ timeout: 15_000 });
    await page.getByLabel('Amount').fill('-500');
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
  }) => {
    // B8's A1-5. An account with no charges answers an empty page, not an error — and the picker
    // says so, which is the state a mistyped id lands in.
    const monetization = new MonetizationPage(page);
    await monetization.goto(MONETIZATION_ROUTES[3]!);

    await page.getByLabel('User ID').last().fill('00000000-0000-4000-8000-000000000000');

    await expect(page.getByText('No payments on this account')).toBeVisible({ timeout: 15_000 });
    await monetization.expectNoErrorPanel();
  });

  test('a grant does NOT confirm — only the destructive direction does', async ({ page }) => {
    const monetization = new MonetizationPage(page);
    await monetization.goto(MONETIZATION_ROUTES[3]!);

    await page.getByLabel('User ID').fill('00000000-0000-4000-8000-000000000000');
    await page.getByLabel('Amount').fill('250');

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

  test('the subscriptions dashboard looks up ONE account', async ({ page }) => {
    // A1's premise, closed by B8 (A1-7). Unconditional, unlike the sentence it replaces: the lookup
    // sits outside the emptiness check, because an operator can need to confirm an account is on
    // free whether or not anyone on the install has ever subscribed.
    const monetization = new MonetizationPage(page);
    await monetization.goto(MONETIZATION_ROUTES[5]!);

    await expect(page.getByText('Look up one account')).toBeVisible();
    await page.getByLabel('User ID').fill('00000000-0000-4000-8000-000000000000');

    // No subscription row → the free-plan card, which is a statement and not an error. This is the
    // platform's commonest account state and it must never render as a failure.
    await expect(page.getByText('Free plan')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('alert')).toHaveCount(0);
    await monetization.expectNoErrorPanel();
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
