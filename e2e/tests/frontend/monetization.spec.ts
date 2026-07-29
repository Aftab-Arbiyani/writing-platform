import { freshLogin } from '../../fixtures/auth';
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
   * The subscribe leg, driven for real.
   *
   * Both server refusals are exercised, because a deployment can be in either state and they are
   * different sentences to a reader: the flag being down (the default) and the flag being up with no
   * provider credentials. The payments flag is restored afterwards — it is global, and leaving it
   * changed would alter the starting state every later spec observes.
   */
  test('subscribing explains itself honestly when the platform is dark', async ({ page, api }) => {
    const previous = await api.setPaymentsEnabled(false);

    const plans = new PlansPage(page);
    await plans.goto();
    await plans.expectResolved();
    await plans.choose('Plus');
    await plans.expectPaymentsUnavailable();

    await api.setPaymentsEnabled(previous);
  });

  test('subscribing explains itself when no payment provider is configured', async ({
    page,
    api,
  }) => {
    // With the platform flag UP, the request reaches the payment registry — and is declined, because no
    // adapter has credentials on this stack. Asserting this is what proves the client does not fake a
    // checkout: it drove the real button to the real endpoint and reported what came back.
    const previous = await api.setPaymentsEnabled(true);
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

  /**
   * **The row's real payoff: an entitlement granted server-side opens the client's gate.**
   *
   * `ai_budget` is the only premium feature any server route enforces (`AiUsageMeterService.checkQuota`
   * is the backend's single `assertAllowed` call), which is why the credits balance card is gated on it
   * and why this is the one gate whose client and server cannot disagree. A `deny` override closes it; a
   * revoke reopens it. Both directions are asserted, through the real Entitlement Service, so this
   * proves the whole path — admin write → decision cache invalidation → snapshot read → rendered gate.
   *
   * Arranged on the shared seeded writer and cleaned up in `finally`: an override left in place would
   * deny AI to every later spec on the same account.
   */
  test('an entitlement denial closes the gate, and revoking it opens it again', async ({
    page,
    api,
  }) => {
    const credits = new CreditsPage(page);
    await credits.goto();
    await credits.expectResolved();

    const writerId = await api.writerId();
    const override = await api.grantEntitlementOverride({
      userId: writerId,
      feature: 'ai_budget',
      effect: 'deny',
      reason: 'e2e af5 gate',
    });

    try {
      // The server side, asserted directly — so a failure here is unambiguously the grant, not the UI.
      const token = await api.loginToken('writer@qalam.local', 'ChangeMe!Writer1');
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
