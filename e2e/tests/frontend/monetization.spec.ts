import { freshLogin, freshLoginAs } from '../../fixtures/auth';
import { AI_FLAG_TEST_TIMEOUT_MS, withAiFeatures } from '../../fixtures/feature-flags';
import { test, expect } from '../../fixtures/test';
import { BillingPage } from '../../pages/frontend/billing-page';
import { EditorPage } from '../../pages/frontend/editor-page';
import { WritingToolsDrawer } from '../../pages/frontend/writing-tools-drawer';
import { BillingHistoryPage, UsagePage } from '../../pages/frontend/billing-detail-pages';
import { PlansPage } from '../../pages/frontend/plans-page';

/**
 * Monetization (AF5 / W4, row `af5`) — `features/monetization`'s five surfaces against the real stack.
 *
 * **What this row was asked to prove, and what it actually can.** [06 §6] parked `af5` on the grounds
 * that no client subscribe UI existed and that "the third-party allowance covers running against an
 * inert port". The first half is now closed — the UI exists. The second half turns out not to hold:
 * there is no inert payment port. Every adapter is key-gated (`StripeAdapter.isConfigured()` and its
 * Apple/Google siblings each test a secret for emptiness) and `PaymentProvider.Manual` is in the
 * vocabulary with **no adapter at all**, so on a stack without third-party credentials the registry
 * answers `PAYMENT_PROVIDER_NOT_CONFIGURED` for every provider including `manual`. Verified live
 * against this backend. The port does not no-op; it declines (docs/48 §3.6, W4-4).
 *
 * So "subscribe → entitlement granted" is asserted in the two halves the stack can actually support,
 * and neither is a mock:
 *
 * 1. **Subscribe** is driven for real, through the real button, to the real endpoint — and the
 *    assertion is the honest refusal the server gives, with nothing charged. That IS this deployment's
 *    contract, and it is the same shape as the writing-tools spec asserting the unavailable notice.
 * 2. **Entitlement granted → the gate opens** is proven end to end through the Entitlement Service, via
 *    an admin override. Same service, same snapshot the client gates on, same cache invalidation as a
 *    subscription transition — just reached without a card. This is the half that proves the pipeline.
 *
 * Stubbing `/monetization/subscription` to fake a successful checkout is not an option: [README
 * §invariants] forbids faking success at the app boundary. Closing the payment leg needs a configured
 * provider (a Stripe test key) in the E2E stack — a stack item, recorded in [06 §6], not a client gap.
 *
 * The suite runs with `VITE_ENABLE_MONETIZATION=true` (playwright.config `webServer`); the surfaces are
 * dark by default, so without it every test here would pass against "Plans aren't available yet".
 */
test.describe('@phase4 frontend monetization', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'writer');
  });

  test('the billing hub is a settings section and links its four sub-surfaces', async ({
    page,
  }) => {
    const billing = new BillingPage(page);
    await billing.goto();
    await billing.expectResolved();
    await billing.expectInSettingsNav();
    await billing.expectAllSectionsLinked();
  });

  test('a free reader gets an upsell, not an error', async ({ page }) => {
    // `GET /monetization/subscription` answers a privacy-preserving 404 for a user with no
    // subscription, which is the MAJORITY state. A client that let that surface as an error would show
    // every free reader a failure where the honest surface is "here are the plans".
    const billing = new BillingPage(page);
    await billing.goto();
    await billing.expectFreePlan();
  });

  test('the hub navigates to each sub-surface', async ({ page }) => {
    const billing = new BillingPage(page);
    await billing.goto();
    await billing.expectResolved();

    await billing.openSection('Usage');
    await expect(page).toHaveURL(/\/settings\/billing\/usage$/);

    await billing.goto();
    await billing.openSection('Billing history');
    await expect(page).toHaveURL(/\/settings\/billing\/history$/);
  });

  test('the plan catalogue renders real prices and switches interval', async ({ page }) => {
    const plans = new PlansPage(page);
    await plans.goto();
    await plans.expectResolved();

    // From the live pricing config: Plus is $4.99/mo and $49.90/yr.
    await plans.expectPrice('$4.99');
    await plans.selectInterval('Yearly');
    await plans.expectPrice('$49.90');
  });

  test('the free tier shows no price, because the catalogue quotes none', async ({ page }) => {
    // Free arrives as `{ none: { usd: 0 } }` — there is no `monthly` key on it. A client that indexed
    // the shown interval blindly would print "$0.00 / mo", inventing a price.
    const plans = new PlansPage(page);
    await plans.goto();
    await plans.expectResolved();
    await plans.expectFreeHasNoPrice();
  });

  test('an unknown promo code is rejected as invalid, not surfaced as a failure', async ({
    page,
    data,
  }) => {
    // `POST /coupons/validate` catches both coupon exceptions and resolves `{ valid: false }`, so the
    // surface must read as a refusal of the code rather than a broken request. Mobile has no coupon UI
    // at all (docs/48 §3.7, M5-2), so this is the first client to exercise the endpoint.
    const plans = new PlansPage(page);
    await plans.goto();
    await plans.expectResolved();
    await plans.applyPromoCode(
      `NOPE${data
        .username()
        .replace(/[^a-z0-9]/gi, '')
        .toUpperCase()
        .slice(0, 8)}`,
    );
    await plans.expectPromoRejected();
  });

  /**
   * **Serial, and it has to be.** Both tests below flip `feature.payments.enabled`, which is a single
   * global row shared by every worker — and the suite runs `fullyParallel` across 8 of them. Run in
   * parallel they race: the dark test sets the flag false while the payment test is mid-checkout, which
   * is exactly how this first failed (`MONETIZATION_DISABLED` on a request that should have succeeded).
   *
   * `describe.serial` pins them to one worker in order. The rest of the file stays parallel because
   * nothing else here mutates server-global state — ~~the entitlement-override test scopes its change to
   * one user, which is why it does not need to be in here.~~
   *
   * **That last clause was wrong, and it cost a CI-blocking failure (2026-08-25).** "Global state"
   * is the wrong test for isolation. The entitlement-override test scoped its `deny` to one user —
   * the SHARED SEEDED WRITER, which is the account every other test in this file runs as — so it
   * closed the `ai_budget` gate underneath the parallel credits test and left it timing out on a
   * Balance card that had been replaced by a lock. It now uses a throwaway account and genuinely
   * does not need to be in here. **The rule to apply is "does any parallel test read what this one
   * writes", not "is the row global".**
   */
  test.describe.serial('the platform flag', () => {
    /**
     * The subscribe leg, driven for real and completed for real.
     *
     * **This is what W4-4 unblocked.** When W4 shipped, no provider could complete a checkout in any
     * environment without third-party credentials — every adapter is key-gated and `PaymentProvider.Manual`
     * was in the vocabulary with no implementation, so the row could only assert a refusal. `ManualAdapter`
     * fills that documented gap: it settles a charge without a processor, off unless
     * `PAYMENTS_MANUAL_ENABLED` says otherwise, which this stack sets.
     *
     * A **throwaway** subscriber, not the shared writer, for two reasons: a subscription is a
     * once-per-account state that would make a second run collide with `SUBSCRIPTION_ALREADY_ACTIVE`, and
     * trial eligibility is once-per-account too, so only a fresh user reaches `trialing` deterministically.
     */
    test('subscribing records a payment and grants the entitlement, end to end', async ({
      page,
      api,
      data,
    }) => {
      const previous = await api.setPaymentsEnabled(true);
      try {
        const password = 'ChangeMe!E2ESubscriber1';
        const subscriber = await api.createVerifiedUser({
          email: `af5-subscriber-${data.username()}@qalam.local`,
          username: data.username(),
          password,
        });
        const token = await api.loginToken(subscriber.email, password);

        // Before: the free tier excludes ai_writing.
        const before = await api.entitlements(token);
        expect(
          before.features.find((f) => f.feature === 'ai_writing')?.allowed,
          'a fresh account should not be entitled to ai_writing',
        ).toBe(false);

        // Subscribe → the charge settles in the same request (no redirect, no webhook to wait for).
        const checkout = await api.subscribe(token, { tier: 'plus', interval: 'monthly' });
        expect(checkout.checkoutUrl, 'a settled charge needs no redirect').toBeNull();
        expect(checkout.subscription.tier).toBe('plus');
        expect(checkout.subscription.provider).toBe('manual');

        // PAYMENT — the leg that was unassertable before. A subscription row alone would not prove the
        // billing ledger ran; these two rows are what `recordSuccessfulCharge` writes.
        const payments = await api.payments(token);
        expect(payments, 'a completed checkout must record a payment').toHaveLength(1);
        expect(payments[0]?.status).toBe('succeeded');
        expect(payments[0]?.amount).toBe(499); // Plus monthly, from the live pricing config.

        const invoices = await api.invoices(token);
        expect(invoices, 'a completed checkout must record an invoice').toHaveLength(1);
        expect(invoices[0]?.status).toBe('paid');

        // ENTITLEMENT — the plan the payment bought is now granted, recomputed by the Entitlement Service.
        const after = await api.entitlements(token);
        expect(after.tier).toBe('plus');
        expect(
          after.features.find((f) => f.feature === 'ai_writing')?.allowed,
          'the paid plan must grant ai_writing',
        ).toBe(true);

        // And the client renders it: the hub shows the tier, and billing history shows the receipt.
        await freshLoginAs(page, subscriber.email, password);
        const billing = new BillingPage(page);
        await billing.goto();
        await billing.expectTier('Plus');

        const history = new BillingHistoryPage(page);
        await history.goto();
        await history.expectResolved();
        await history.expectRowCount(1);
        await history.selectTab('Payments');
        await history.expectRowCount(1);
      } finally {
        await api.setPaymentsEnabled(previous);
      }
    });

    /**
     * The refusal is still a real state and still asserted — it is what a deployment shows before an admin
     * raises the platform flag, which is every deployment's default.
     */
    test('subscribing explains itself honestly when the platform is dark', async ({
      page,
      api,
    }) => {
      const previous = await api.setPaymentsEnabled(false);
      try {
        const plans = new PlansPage(page);
        await plans.goto();
        await plans.expectResolved();
        await plans.choose('Plus');
        await plans.expectPaymentsUnavailable();
      } finally {
        await api.setPaymentsEnabled(previous);
      }
    });
  });

  /**
   * **The row's real payoff: an entitlement granted server-side opens the client's gate.**
   *
   * **D5 moved this test's subject from `ai_budget` to `ai_writing`.** `ai_budget` was the blanket
   * "may you use AI at all" code the meter asserted on every request to guard a credit balance; B4
   * removed the balance and the assertion, so a deny override on it now closes nothing and this test
   * would have passed against a gate that no longer exists. `ai_writing` is enforced
   * (`AiUsageMeterService.checkQuota` asserts the feature's own code) and gates the writing tools,
   * so it is the gate whose client and server cannot disagree.
   *
   * A `deny` override closes it; a revoke reopens it. Both directions are asserted, through the real
   * Entitlement Service, so this proves the whole path — admin write → decision cache invalidation →
   * snapshot read → rendered gate.
   *
   * **On a THROWAWAY account, not the shared seeded writer.** It used to use the writer, and the
   * serial block above excused it from serialization on the grounds that it "scopes its change to
   * one user". That premise was false: scoping to one user is not isolation when it is the account
   * every other test in this file runs as. While this test held its `deny`, the parallel credits
   * test — whose Balance card is behind the very same `PremiumGate feature={AiBudget}` — rendered
   * the lock instead of a balance and timed out looking for `region "Balance"`. That was RS-flake's
   * neighbour in the 2026-08-25 full run, and it is a genuine cross-test race on a PER-USER
   * resource, which is the kind the "global state only" rule above does not catch.
   *
   * A throwaway is the house pattern for exactly this — `fixtures/entitlements.ts` uses one for the
   * `allow` direction and says why: "so a leaked grant cannot quietly disarm another spec". The
   * override is still revoked in `finally`; the account is left behind deliberately (the stack is
   * disposable, [09 §4]).
   */
  test('an entitlement denial closes the gate, and revoking it opens it again', async ({
    page,
    api,
    data,
  }) => {
    const creds = { email: data.email(), username: data.username(), password: data.password() };
    const subject = await api.createVerifiedUser(creds);
    await freshLoginAs(page, creds.email, creds.password);

    /**
     * The subject is the editor's Polish tab, because that is what `ai_writing` actually gates. A
     * granted account sees the action; a denied one sees the lock naming the tier.
     *
     * The master AI flag has to be up for the drawer to be reachable at all — the editor hides its
     * trigger while the platform is off — and the writer needs something written before Polish
     * enables its actions.
     */
    const drawer = new WritingToolsDrawer(page);
    const openPolish = async (): Promise<void> => {
      const editor = new EditorPage(page);
      await editor.goto();
      await editor.writePiece({ title: data.pieceTitle(), body: 'A door, and then a lamp.' });
      await editor.waitForSaved();
      await drawer.open();
    };

    test.setTimeout(AI_FLAG_TEST_TIMEOUT_MS);
    await withAiFeatures(
      ['feature.ai.writingAssistant.enabled'],
      'monetization: ai_writing gate',
      async () => {
        const granted = await api.grantEntitlementOverride({
          userId: subject.id,
          feature: 'ai_writing',
          reason: 'e2e af5 gate (allow)',
        });
        try {
          await openPolish();
          await drawer.expectAvailable();
        } finally {
          await api.revokeEntitlementOverride(granted.id);
        }

        const denied = await api.grantEntitlementOverride({
          userId: subject.id,
          feature: 'ai_writing',
          effect: 'deny',
          reason: 'e2e af5 gate (deny)',
        });
        try {
          // The server side, asserted directly — so a failure here is unambiguously the grant, not
          // the UI.
          const token = await api.loginToken(creds.email, creds.password);
          const snapshot = await api.entitlements(token);
          expect(
            snapshot.features.find((f) => f.feature === 'ai_writing')?.allowed,
            'the override did not reach the entitlement snapshot',
          ).toBe(false);

          // The client side: a full reload, because the snapshot is cached for 60s in step with the
          // server's own TTL and this test must not depend on that window elapsing.
          await openPolish();
          // D5's copy names the TIER, derived from `DEFAULT_PLAN_FEATURES` — "a paid plan" left the
          // writer to go and find out which one.
          await expect(page.getByText('Polish & feedback is on Plus and above')).toBeVisible({
            timeout: 30_000,
          });
          await expect(drawer.activePanel.getByRole('button', { name: 'Condense' })).toHaveCount(0);
        } finally {
          await api.revokeEntitlementOverride(denied.id);
        }
      },
    );
  });

  test('usage renders one allowance card per tool, uncapped on this stack', async ({ page }) => {
    // D5 replaced three token windows with one card per writing tool. The labels are the SERVER's
    // (`AI_QUOTA_RULES`), which is why they are asserted by name rather than by position.
    //
    // **Uncapped, and not by accident.** `e2e-fixtures.seed.ts` sets all three allowance keys to
    // `0` (= unlimited) on the free plan for this stack, because the suite runs far more Polish
    // round-trips than any real plan allows and would otherwise 429 in *arrange* — the B4-1 /
    // B6 defect shape. An unlimited allowance deliberately draws NO progress bar, so asserting
    // one here fails against correct product behaviour. This asserts the rendering that stack
    // actually produces.
    //
    // ⚠️ **Coverage gap, recorded rather than hidden:** the bar's ARIA values
    // (`expectAllowanceBar`) are therefore never exercised in a browser. Restoring that needs a
    // writer with a FINITE allowance, and an entitlement override cannot supply one —
    // `EntitlementService.getLimits` reads the plan definition only and ignores overrides
    // entirely. It would take a writer on a paid tier, since the seed patches `free` alone.
    const usage = new UsagePage(page);
    await usage.goto();
    await usage.expectResolved();
    await usage.expectUncapped('Polish');
    await usage.expectUncapped('Manuscript feedback');
    await usage.expectUncapped('Story analyses');
  });

  test('billing history opens all four ledgers, empty rather than errored', async ({ page }) => {
    const history = new BillingHistoryPage(page);
    await history.goto();
    await history.expectResolved();

    await history.expectEmpty(/No invoices yet/);
    await history.selectTab('Payments');
    await history.expectEmpty(/No payments yet/);
    await history.selectTab('Purchases');
    await history.expectEmpty(/No purchases yet/);

    // The one that breaks the pattern: this endpoint 404s for a viewer with no subscription where its
    // three siblings answer an empty page, so reaching "No plan changes yet" instead of an error panel
    // is what proves the client's mapping (docs/48 §3.6, W4-1).
    await history.selectTab('Plan changes');
    await history.expectEmpty(/No plan changes yet/);
  });
});
