import type { BillingInterval, PaymentProvider, PlanTier, PremiumFeature } from '@qalam/shared';

import { get, getPage, post, type CursorPage } from '@/lib/api-client';
import { buildQueryString } from '@/lib/http';

import type {
  CheckoutResponse,
  EntitlementSnapshot,
  FeatureEntitlementResponse,
  InvoiceResponse,
  PaymentResponse,
  PlansResponse,
  PurchaseResponse,
  RestorePurchasesResult,
  SubscriptionEventResponse,
  SubscriptionResponse,
  UsageSummaryResponse,
  ValidateCouponResponse,
} from '../types/monetization.types';

/**
 * The monetization feature's `api/` layer (AF5, W4) — the only place these twenty routes are named
 * (docs/32 §10). Ported from mobile's `monetization_remote_data_source.dart`, whose field mapping
 * `qalam-mobile/docs/56` audited clean against every one of them; each shape below was re-confirmed
 * against the live backend while this layer was written, not taken on trust.
 *
 * **All twenty are coarse-gated on `@Permissions(PERMISSIONS.BillingUse)`**, which `Role.User`
 * holds, and none of them asserts an entitlement — the entitlement decisions these routes *return*
 * are data, not gates. So there is no route here where the guard and the Entitlement Service can
 * disagree, which is the W3c-1 defect class this port was asked to check for (verified live: every
 * read below answers 200 for the seeded writer on a pre-existing database, so the `billing.use`
 * seed-grant defect fixed in de61316 is confirmed closed).
 *
 * **Two failure modes are normal here, not exceptional.** The mutating routes additionally call
 * `MonetizationFeatureService.assertEnabled()`, so they answer `MONETIZATION_DISABLED` (503) while
 * the pre-seeded `feature.payments.enabled` flag is down — which is the default state. With the
 * flag up they reach the payment registry, which answers `PAYMENT_PROVIDER_NOT_CONFIGURED` (503)
 * for every provider lacking credentials. Both are honest, expected states the UI renders as such;
 * neither is faked around.
 */

const BASE = '/monetization';

export const monetizationApi = {
  // ── Plans & coupons ─────────────────────────────────────────────────────────────────────

  /**
   * GET /monetization/plans — the catalogue for the comparison screen.
   *
   * `prices` is keyed interval → currency → **minor units** (cents), and only the intervals a plan
   * actually offers are present: the free tier arrives as `{ none: { usd: 0 } }`, not as a zero
   * monthly price, so a caller must not assume a `monthly` key exists.
   */
  plans: (region?: string, signal?: AbortSignal): Promise<PlansResponse> =>
    get<PlansResponse>(`${BASE}/plans${buildQueryString({ region })}`, { signal }),

  /**
   * POST /monetization/coupons/validate — preview a code before checkout.
   *
   * **Never throws for a bad code.** The controller catches `COUPON_NOT_FOUND` /
   * `COUPON_NOT_REDEEMABLE` and answers `{ valid: false, type: '', discountedAmount: null,
   * description: '' }` (confirmed live), so callers branch on `valid`, never on a rejection.
   *
   * `discountedAmount` is only computed when BOTH `tier` and `interval` are sent — the controller
   * prices the base amount from them and otherwise passes 0 — so pass both to get a real figure.
   */
  validateCoupon: (input: {
    code: string;
    tier?: PlanTier;
    interval?: BillingInterval;
  }): Promise<ValidateCouponResponse> =>
    post<ValidateCouponResponse>(`${BASE}/coupons/validate`, input),

  // ── Entitlements — the single source of truth for premium access ─────────────────────────

  /** GET /monetization/entitlements — the server-authoritative snapshot the UI gates on. */
  entitlements: (signal?: AbortSignal): Promise<EntitlementSnapshot> =>
    get<EntitlementSnapshot>(`${BASE}/entitlements`, { signal }),

  /**
   * GET /monetization/entitlements/:feature — one feature's decision.
   *
   * Accepts any string and **denies unknown features** rather than 404ing (verified live: an
   * invented feature answers `{ allowed: false, reason: 'plan_excludes' }`), so it fails closed —
   * but a typo is indistinguishable from a genuine denial. Prefer the snapshot, which names the
   * features the server actually knows about.
   */
  entitlement: (
    feature: PremiumFeature | string,
    signal?: AbortSignal,
  ): Promise<FeatureEntitlementResponse> =>
    get<FeatureEntitlementResponse>(`${BASE}/entitlements/${encodeURIComponent(feature)}`, {
      signal,
    }),

  // ── Subscription lifecycle ──────────────────────────────────────────────────────────────

  /**
   * GET /monetization/subscription — the current subscription.
   *
   * **404s `SUBSCRIPTION_NOT_FOUND` when the user has none**, which is the ordinary free-tier state
   * rather than an error; `useSubscription` maps it to `null`.
   */
  subscription: (signal?: AbortSignal): Promise<SubscriptionResponse> =>
    get<SubscriptionResponse>(`${BASE}/subscription`, { signal }),

  /**
   * POST /monetization/subscription — start a checkout.
   *
   * Answers either a provider-hosted `checkoutUrl` to open (Stripe) or an already-activated
   * subscription with a null url (a store receipt, validated server-side). `receipt` is not sent
   * from the web client: a store purchase happens on a device, and the client never validates a
   * purchase itself.
   */
  subscribe: (input: {
    tier: PlanTier;
    interval: BillingInterval;
    provider: PaymentProvider;
    couponCode?: string;
  }): Promise<CheckoutResponse> => post<CheckoutResponse>(`${BASE}/subscription`, input),

  /**
   * POST /monetization/subscription/change — upgrade / downgrade / switch interval.
   *
   * `atPeriodEnd` schedules the change instead of applying it: the caller sets it for a downgrade
   * (the subscriber keeps what they paid for until the period ends) and leaves it off for an
   * upgrade, which is immediate and prorated.
   */
  changePlan: (input: {
    tier: PlanTier;
    interval: BillingInterval;
    atPeriodEnd?: boolean;
  }): Promise<SubscriptionResponse> =>
    post<SubscriptionResponse>(`${BASE}/subscription/change`, input),

  /** POST /monetization/subscription/cancel — at period end by default, or immediately. */
  cancel: (input: { immediate?: boolean; reason?: string } = {}): Promise<SubscriptionResponse> =>
    post<SubscriptionResponse>(`${BASE}/subscription/cancel`, input),

  /** POST /monetization/subscription/reactivate — undo a pending cancellation. */
  reactivate: (): Promise<SubscriptionResponse> =>
    post<SubscriptionResponse>(`${BASE}/subscription/reactivate`),

  /** POST /monetization/subscription/pause — a temporary hold that keeps the row. */
  pause: (): Promise<SubscriptionResponse> =>
    post<SubscriptionResponse>(`${BASE}/subscription/pause`),

  /** POST /monetization/subscription/resume — lift a pause. */
  resume: (): Promise<SubscriptionResponse> =>
    post<SubscriptionResponse>(`${BASE}/subscription/resume`),

  /**
   * GET /monetization/subscription/history — lifecycle events, cursor-paginated.
   *
   * Answers an empty page for a viewer with no subscription, like the three sibling ledgers below.
   * That was not true when W4 shipped — it 404'd `SUBSCRIPTION_NOT_FOUND` for every free reader, and
   * the hook compensated — until W4-1 fixed the service to scope by `user_id` (docs/48 §3.6).
   */
  subscriptionHistory: (
    cursor?: string,
    limit?: number,
  ): Promise<CursorPage<SubscriptionEventResponse>> =>
    getPage<SubscriptionEventResponse>(
      `${BASE}/subscription/history${buildQueryString({ cursor, limit })}`,
    ),

  // ── Usage ───────────────────────────────────────────────────────────────────────────────

  /**
   * GET /monetization/usage — the caller's per-tool allowances (D5), plus the token rollups the
   * admin dashboards still read.
   *
   * An allowance with `unlimited: true` carries a null `limit`, so anything drawing a progress bar
   * must check that first rather than dividing by a limit that may be absent — see
   * `normalizeAllowances`, which makes the guarantee total.
   *
   * D5 removed three methods that lived under this heading: `credits`, `creditTransactions` and
   * `purchaseCredits`. All three now 404 — B4 deleted the wallet, the ledger and the pack purchase.
   */
  usage: (signal?: AbortSignal): Promise<UsageSummaryResponse> =>
    get<UsageSummaryResponse>(`${BASE}/usage`, { signal }),

  // ── Billing history ─────────────────────────────────────────────────────────────────────

  /** GET /monetization/invoices — billing documents, cursor-paginated. */
  invoices: (cursor?: string, limit?: number): Promise<CursorPage<InvoiceResponse>> =>
    getPage<InvoiceResponse>(`${BASE}/invoices${buildQueryString({ cursor, limit })}`),

  /** GET /monetization/payments — the payment ledger, cursor-paginated. */
  payments: (cursor?: string, limit?: number): Promise<CursorPage<PaymentResponse>> =>
    getPage<PaymentResponse>(`${BASE}/payments${buildQueryString({ cursor, limit })}`),

  /** GET /monetization/purchases — one-time + store purchases, cursor-paginated. */
  purchases: (cursor?: string, limit?: number): Promise<CursorPage<PurchaseResponse>> =>
    getPage<PurchaseResponse>(`${BASE}/purchases${buildQueryString({ cursor, limit })}`),

  /**
   * POST /monetization/purchases/restore — re-grant from a store receipt.
   *
   * Returns `{ restored, providerRef, expiresAt }`. `@qalam/api-types` used to declare a different
   * shape entirely; W4-2 corrected the package against this controller and pinned the two together, so
   * {@link RestorePurchasesResult} is now just an alias of the package type. Store-receipt-only, so like
   * credit purchases this has no browser path; the method exists for contract completeness and is not
   * wired to a control.
   */
  restorePurchases: (input: {
    provider: PaymentProvider;
    receipt: string;
  }): Promise<RestorePurchasesResult> =>
    post<RestorePurchasesResult>(`${BASE}/purchases/restore`, input),
};
