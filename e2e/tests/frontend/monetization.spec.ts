import { freshLogin, freshLoginAs } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { BillingPage } from '../../pages/frontend/billing-page';
import {
  BillingHistoryPage,
  CreditsPage,
  UsagePage,
} from '../../pages/frontend/billing-detail-pages';
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
 *    contract, and it is the same shape as the assistant spec asserting "AI is turned off".
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

    await billing.openSection('AI usage');
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
   * `ai_budget` is the only premium feature any server route enforces (`AiUsageMeterService.checkQuota`
   * is the backend's single `assertAllowed` call), which is why the credits balance card is gated on it
   * and why this is the one gate whose client and server cannot disagree. A `deny` override closes it; a
   * revoke reopens it. Both directions are asserted, through the real Entitlement Service, so this
   * proves the whole path — admin write → decision cache invalidation → snapshot read → rendered gate.
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

    const credits = new CreditsPage(page);
    await credits.goto();
    await credits.expectResolved();

    const override = await api.grantEntitlementOverride({
      userId: subject.id,
      feature: 'ai_budget',
      effect: 'deny',
      reason: 'e2e af5 gate',
    });

    try {
      // The server side, asserted directly — so a failure here is unambiguously the grant, not the UI.
      const token = await api.loginToken(creds.email, creds.password);
      const snapshot = await api.entitlements(token);
      expect(
        snapshot.features.find((f) => f.feature === 'ai_budget')?.allowed,
        'the override did not reach the entitlement snapshot',
      ).toBe(false);

      // The client side: a full reload, because the snapshot is cached for 60s in step with the
      // server's own TTL and this test must not depend on that window elapsing.
      await credits.goto();
      await credits.expectBalanceGated();
    } finally {
      await api.revokeEntitlementOverride(override.id);
    }

    await credits.goto();
    await credits.expectResolved();
  });

  test('AI usage renders three windows with an accessible allowance bar', async ({ page }) => {
    const usage = new UsagePage(page);
    await usage.goto();
    await usage.expectResolved();
    await usage.expectAllowanceBar('Today');
    await usage.expectAllowanceBar('This month');
    // Lifetime has no cap by definition, so it must draw no bar rather than an empty one.
    await usage.expectLifetimeUncapped();
  });

  test('credits shows a balance and no dead purchase button', async ({ page }) => {
    // `POST /credits/purchase` rejects an empty receipt before it reaches a provider, and a browser has
    // no receipt to send — so the web must explain where credits come from instead of offering three
    // packs that cannot work. Mobile offers the packs because a phone can produce a receipt.
    const credits = new CreditsPage(page);
    await credits.goto();
    await credits.expectResolved();
    await credits.expectNoBrowserPurchasePath();
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
