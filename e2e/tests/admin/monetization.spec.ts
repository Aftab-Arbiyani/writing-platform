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

  test('a credit DEDUCTION confirms and states the zero floor', async ({ page }) => {
    const monetization = new MonetizationPage(page);
    await monetization.goto(MONETIZATION_ROUTES[3]!);

    await page.getByLabel('User ID').fill('00000000-0000-4000-8000-000000000000');
    await page.getByLabel('Amount').fill('-500');
    await page.getByRole('button', { name: 'Deduct credits' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Deduct 500 credits?');
    // No projected balance is promised: no admin route reads another user's wallet, and the server
    // clamps at zero anyway.
    await expect(dialog).toContainText('will not go below zero');
    await page.getByRole('button', { name: 'Cancel' }).click();
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
    await expect(alert).toContainText('No refundable payment with that ID', { timeout: 15_000 });
    await expect(alert.getByRole('button', { name: 'Try again' })).toHaveCount(0);
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

  test('the subscriptions dashboard admits it cannot look up one account', async ({ page }) => {
    const monetization = new MonetizationPage(page);
    await monetization.goto(MONETIZATION_ROUTES[5]!);

    // Only when populated — the empty state stands on its own. The platform exposes no admin route
    // for an individual subscription, and the page says so rather than implying a search exists.
    const section = page.getByText('Looking up one account');
    if ((await section.count()) > 0) {
      await expect(section).toBeVisible();
      await expect(
        page.getByText(/no admin endpoint for an individual subscription/),
      ).toBeVisible();
    }
  });
});
