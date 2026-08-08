/**
 * Monetization Platform vocabulary (AF5 — Subscriptions, Entitlements, AI Usage,
 * Payments, Credits, Promotions, Pricing).
 *
 * The provider-agnostic domain language for the reusable **Monetization Platform**:
 * the Entitlement Service is the single source of truth for premium access, the
 * Usage/Credit services own AI metering, the Subscription service owns lifecycle,
 * and the Billing service owns payment processing behind a replaceable provider port.
 *
 * Like the rest of `@qalam/shared` this is zero-dependency pure vocabulary — `as const`
 * objects + derived union types (JSON-safe wire strings) + pure helpers + guardrail
 * constants. Sets are deliberately OPEN (varchar columns) where a new plan/provider/
 * feature must land without a migration, so future revenue models (marketplace, team/
 * family plans, seat licensing, gift subscriptions, affiliate programs, more payment
 * providers) slot in behind this same vocabulary with zero architectural change.
 *
 * Design law (docs/37): the Entitlement Service owns access decisions, the Subscription
 * service owns lifecycle, Billing owns payment, Usage owns AI consumption, Credit owns
 * AI credits — never scatter feature checks; never trust client-side billing validation;
 * all monetization decisions remain server-authoritative.
 */

// ── Plans & billing cadence ─────────────────────────────────────────────────────

/** Subscription plan tiers. `free` is the implicit default (no subscription row). */
export const PlanTier = {
  Free: 'free',
  Plus: 'plus',
  Pro: 'pro',
  Enterprise: 'enterprise',
} as const;
export type PlanTier = (typeof PlanTier)[keyof typeof PlanTier];

/** Plan tiers in ascending rank order — the basis for upgrade/downgrade detection. */
export const PLAN_TIER_ORDER: readonly PlanTier[] = [
  PlanTier.Free,
  PlanTier.Plus,
  PlanTier.Pro,
  PlanTier.Enterprise,
];

/** Billing cadence for a paid plan. `none` = free / non-recurring. */
export const BillingInterval = {
  None: 'none',
  Monthly: 'monthly',
  Yearly: 'yearly',
} as const;
export type BillingInterval = (typeof BillingInterval)[keyof typeof BillingInterval];

// ── Subscription lifecycle ────────────────────────────────────────────────────

/**
 * Subscription lifecycle state. The Subscription service owns transitions; the
 * Entitlement service derives access from this + overrides. `pending_activation`
 * covers checkout-started-but-not-confirmed; `grace_period` covers a failed renewal
 * within the dunning window; `paused` is a temporary hold that keeps the row.
 */
export const SubscriptionStatus = {
  PendingActivation: 'pending_activation',
  Trialing: 'trialing',
  Active: 'active',
  PastDue: 'past_due',
  GracePeriod: 'grace_period',
  Paused: 'paused',
  Canceled: 'canceled',
  Expired: 'expired',
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

/** Subscription statuses that still grant premium access (full or degraded). */
export const ACCESS_GRANTING_SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  SubscriptionStatus.Trialing,
  SubscriptionStatus.Active,
  SubscriptionStatus.GracePeriod,
  SubscriptionStatus.PastDue,
];

/** History-event kinds recorded on every subscription transition (audit + analytics). */
export const SubscriptionEventType = {
  Created: 'created',
  Activated: 'activated',
  Renewed: 'renewed',
  Upgraded: 'upgraded',
  Downgraded: 'downgraded',
  PlanChangeScheduled: 'plan_change_scheduled',
  Canceled: 'canceled',
  Reactivated: 'reactivated',
  TrialStarted: 'trial_started',
  TrialEnded: 'trial_ended',
  GraceStarted: 'grace_started',
  Expired: 'expired',
  Paused: 'paused',
  Resumed: 'resumed',
  PaymentFailed: 'payment_failed',
  PaymentSucceeded: 'payment_succeeded',
} as const;
export type SubscriptionEventType =
  (typeof SubscriptionEventType)[keyof typeof SubscriptionEventType];

// ── Entitlements (the single source of truth for premium access) ───────────────

/**
 * Premium capabilities gated by the Entitlement Service. OPEN catalogue (stored as
 * varchar) so future capabilities (marketplace, collaboration, enterprise) land with
 * no migration. Every premium code check goes THROUGH the Entitlement Service — never
 * a scattered inline flag.
 */
export const PremiumFeature = {
  AiWriting: 'ai_writing',
  AiDiscovery: 'ai_discovery',
  StoryIntelligence: 'story_intelligence',
  PremiumSearch: 'premium_search',
  PremiumRecommendations: 'premium_recommendations',
  AdvancedAnalytics: 'advanced_analytics',
  PublishingPro: 'publishing_pro',
  /** AI credit / token budget gate (checked by the Usage meter). */
  AiBudget: 'ai_budget',
  // ── Reserved future capabilities (no plan grants them yet). ────────────────
  Marketplace: 'marketplace',
  Collaboration: 'collaboration',
  Enterprise: 'enterprise',
} as const;
export type PremiumFeature = (typeof PremiumFeature)[keyof typeof PremiumFeature];

/**
 * The effective access decision for a (user, feature). `allow` = full access,
 * `limited` = access with a quota/soft cap, `grace_period`/`trial` = time-bounded
 * access, the rest deny. Mirrors the brief's entitlement states so a client renders
 * the correct lock/trial/grace/expired experience — but the server is authoritative.
 */
export const EntitlementStatus = {
  Allow: 'allow',
  Limited: 'limited',
  Trial: 'trial',
  GracePeriod: 'grace_period',
  Deny: 'deny',
  Expired: 'expired',
  Suspended: 'suspended',
  PendingActivation: 'pending_activation',
  Cancelled: 'cancelled',
  Paused: 'paused',
} as const;
export type EntitlementStatus = (typeof EntitlementStatus)[keyof typeof EntitlementStatus];

/** Entitlement statuses under which a capability is usable (full or degraded). */
export const ACCESS_GRANTING_ENTITLEMENT_STATUSES: readonly EntitlementStatus[] = [
  EntitlementStatus.Allow,
  EntitlementStatus.Limited,
  EntitlementStatus.Trial,
  EntitlementStatus.GracePeriod,
];

/** Why the Entitlement Service reached its decision (observability + client copy). */
export const EntitlementReason = {
  PlanIncludes: 'plan_includes',
  Trial: 'trial',
  GracePeriod: 'grace_period',
  Promotional: 'promotional',
  TemporaryAccess: 'temporary_access',
  AdminOverride: 'admin_override',
  LegacyPlan: 'legacy_plan',
  QuotaExceeded: 'quota_exceeded',
  NoSubscription: 'no_subscription',
  PlanExcludes: 'plan_excludes',
  FeatureDisabled: 'feature_disabled',
  Suspended: 'suspended',
  Expired: 'expired',
  DeniedOverride: 'denied_override',
} as const;
export type EntitlementReason = (typeof EntitlementReason)[keyof typeof EntitlementReason];

/** How an administrative / promotional entitlement override behaves. */
export const OverrideEffect = {
  Allow: 'allow',
  Deny: 'deny',
  Limited: 'limited',
} as const;
export type OverrideEffect = (typeof OverrideEffect)[keyof typeof OverrideEffect];

// ── Usage & quota (AI metering) ─────────────────────────────────────────────────

/** Aggregation / reset window for usage accounting and quota checks. */
export const QuotaWindow = {
  Daily: 'daily',
  Monthly: 'monthly',
  Total: 'total',
} as const;
export type QuotaWindow = (typeof QuotaWindow)[keyof typeof QuotaWindow];

/** What a usage/quota limit is measured in. */
export const UsageMetric = {
  Tokens: 'tokens',
  Credits: 'credits',
  Requests: 'requests',
  CostUsd: 'cost_usd',
} as const;
export type UsageMetric = (typeof UsageMetric)[keyof typeof UsageMetric];

/** Soft vs hard quota enforcement (soft warns/degrades; hard blocks). */
export const LimitEnforcement = {
  Soft: 'soft',
  Hard: 'hard',
} as const;
export type LimitEnforcement = (typeof LimitEnforcement)[keyof typeof LimitEnforcement];

// ── Credits (the AI credit ledger) ───────────────────────────────────────────────

/** Direction of a credit-ledger entry. */
export const CreditEntryType = {
  Grant: 'grant',
  Debit: 'debit',
} as const;
export type CreditEntryType = (typeof CreditEntryType)[keyof typeof CreditEntryType];

/** Why a credit-ledger entry was written (source of a grant / reason for a debit). */
export const CreditReason = {
  Purchase: 'purchase',
  SubscriptionGrant: 'subscription_grant',
  TrialGrant: 'trial_grant',
  Promotional: 'promotional',
  Referral: 'referral',
  AiUsage: 'ai_usage',
  Refund: 'refund',
  Expiration: 'expiration',
  AdminAdjustment: 'admin_adjustment',
} as const;
export type CreditReason = (typeof CreditReason)[keyof typeof CreditReason];

// ── Payments & billing ───────────────────────────────────────────────────────────

/**
 * Payment providers behind the replaceable provider port. `stripe`, `apple_app_store`,
 * and `google_play` ship key-gated adapters in AF5; `manual` covers admin/comp grants.
 * Future providers (PayPal, Paddle, RevenueCat) are added as new adapters — no contract
 * or schema change (the column is an open varchar).
 */
export const PaymentProvider = {
  Stripe: 'stripe',
  AppleAppStore: 'apple_app_store',
  GooglePlay: 'google_play',
  Manual: 'manual',
} as const;
export type PaymentProvider = (typeof PaymentProvider)[keyof typeof PaymentProvider];

/** Providers with a shipped adapter in AF5 (the rest are reserved extension points). */
export const IMPLEMENTED_PAYMENT_PROVIDERS: readonly PaymentProvider[] = [
  PaymentProvider.Stripe,
  PaymentProvider.AppleAppStore,
  PaymentProvider.GooglePlay,
];

/** Lifecycle of a single payment (append-only ledger row). */
export const PaymentStatus = {
  Pending: 'pending',
  Succeeded: 'succeeded',
  Failed: 'failed',
  Refunded: 'refunded',
  PartiallyRefunded: 'partially_refunded',
  Disputed: 'disputed',
  Canceled: 'canceled',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

/** How a payment was made (for receipts + display; never card PANs). */
export const PaymentMethodType = {
  Card: 'card',
  ApplePay: 'apple_pay',
  GooglePlay: 'google_play',
  PayPal: 'paypal',
  Unknown: 'unknown',
} as const;
export type PaymentMethodType = (typeof PaymentMethodType)[keyof typeof PaymentMethodType];

/** Invoice lifecycle. Invoices are the durable billing document per period. */
export const InvoiceStatus = {
  Draft: 'draft',
  Open: 'open',
  Paid: 'paid',
  Void: 'void',
  Uncollectible: 'uncollectible',
  Refunded: 'refunded',
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

/** Status of an ingested provider webhook event (idempotency + replay tracking). */
export const WebhookEventStatus = {
  Received: 'received',
  Processed: 'processed',
  Failed: 'failed',
  Ignored: 'ignored',
  Duplicate: 'duplicate',
} as const;
export type WebhookEventStatus = (typeof WebhookEventStatus)[keyof typeof WebhookEventStatus];

// ── Purchases (one-time + store) ─────────────────────────────────────────────────

/** What a purchase bought. */
export const PurchaseKind = {
  Subscription: 'subscription',
  Credits: 'credits',
  OneTime: 'one_time',
} as const;
export type PurchaseKind = (typeof PurchaseKind)[keyof typeof PurchaseKind];

/** Lifecycle of a purchase (append-only). `restored` = re-granted from a store receipt. */
export const PurchaseStatus = {
  Pending: 'pending',
  Completed: 'completed',
  Failed: 'failed',
  Refunded: 'refunded',
  Restored: 'restored',
} as const;
export type PurchaseStatus = (typeof PurchaseStatus)[keyof typeof PurchaseStatus];

// ── Promotions & coupons ─────────────────────────────────────────────────────────

/** What a promotion / coupon grants when redeemed. */
export const PromotionType = {
  PercentageDiscount: 'percentage_discount',
  FixedDiscount: 'fixed_discount',
  FreeTrial: 'free_trial',
  TrialExtension: 'trial_extension',
  PromotionalCredits: 'promotional_credits',
  FreePeriod: 'free_period',
} as const;
export type PromotionType = (typeof PromotionType)[keyof typeof PromotionType];

// ── Wire shapes (client contract) ────────────────────────────────────────────────

/** A configured plan (from the admin-tunable pricing config, not a table). */
export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  description: string;
  /** Premium features this plan grants. */
  features: PremiumFeature[];
  /** Per-feature quota limits (0 / absent = unlimited). */
  limits: PlanLimits;
  /** AI credits granted per billing period (0 = none). */
  monthlyCredits: number;
  /** Price per interval in minor units (cents), keyed by interval then currency. */
  prices: Partial<Record<BillingInterval, Record<string, number>>>;
  /** Free-trial length in days (0 = no trial). */
  trialDays: number;
  /** Provider product/price ids, keyed by provider (opaque to the client). */
  providerRefs?: Record<string, unknown>;
}

/** Per-feature usage limits attached to a plan. */
export interface PlanLimits {
  aiDailyTokens: number;
  aiMonthlyTokens: number;
  aiMonthlyCredits: number;
  /**
   * Reserved extensible per-feature caps (requests/day etc.). **0 / absent = unlimited**, EXCEPT
   * for the keys listed in {@link NEGATIVE_UNLIMITED_LIMIT_KEYS} — read that list before adding a
   * cap, and read {@link resolvePlanLimit} before reading one.
   *
   * Keys that ride this signature rather than being declared above (they are tunable data,
   * so a new cap needs no type change and no migration):
   * - `maxPieces` — how many live (non-deleted) pieces one author may hold (B4, docs/45 §4.9).
   *   Ordinary convention: `0` = unlimited.
   * - `maxCollaborators` — how many collaborators one story may have, by the plan of the author who
   *   OWNS it (B6, docs/45 §4.11). **Inverted sentinel: `-1` ({@link UNLIMITED_SEATS}) = unlimited,
   *   `0` = none.** Free is zero seats, and encoding that as `0` under the ordinary convention would
   *   hand every free author unlimited collaborators. See {@link NEGATIVE_UNLIMITED_LIMIT_KEYS}.
   */
  [key: string]: number;
}

/**
 * The value that means "no cap" for a key in {@link NEGATIVE_UNLIMITED_LIMIT_KEYS}.
 *
 * Named rather than written as a bare `-1` so an admin editing `monetization.plans`, a test, and a
 * client all reach for the same token, and so grepping it finds every site that depends on the
 * inverted reading.
 */
export const UNLIMITED_SEATS = -1;

/**
 * Limit keys whose "unlimited" sentinel is NEGATIVE instead of `0`.
 *
 * ## Why one key breaks the house convention
 *
 * Everywhere else in this codebase `0` means unlimited — `PlanLimits` says so above,
 * `usage.service.ts` enforces `if (limit > 0)`, and `mergePlans` tells administrators that "`0` is
 * how an admin says 'unlimited'". That works because every other cap's zero-value is meaningless:
 * an author allowed `0` pieces could not use the product at all, so nobody would ever configure it.
 *
 * `maxCollaborators` is the first cap where **zero is a real, shipped tier**: B6 sells collaboration
 * outright, so Free gets zero seats (docs/45 §4.11). Under the ordinary convention that tier would
 * read as *unlimited* — the exact inverse of the decision, with green tests and no error anywhere.
 * So this key, and only this key, uses `-1` for unlimited.
 *
 * ## How an admin expresses "unlimited collaborators"
 *
 * By setting `maxCollaborators: -1` — NOT `0`, which means "no collaborators at all". This is the
 * one deviation from the merge contract's promise, it is stated in the admin-facing description of
 * the `monetization.plans` setting, and it is pinned by
 * `monetization.config-service.spec.ts` ("an admin's 0 means the opposite for the two keys").
 *
 * ## Adding to this list
 *
 * Only for a cap where zero is a legitimate configured tier. Reading a key through
 * {@link resolvePlanLimit} is what makes the distinction take effect; reading `limits.someKey`
 * directly bypasses it.
 */
export const NEGATIVE_UNLIMITED_LIMIT_KEYS: readonly string[] = ['maxCollaborators'];

/** A plan limit read through the convention that governs its key. */
export interface ResolvedPlanLimit {
  /** The configured number, as stored. */
  value: number;
  /** True when the plan sets no cap at all. */
  unlimited: boolean;
}

/**
 * Reads one `PlanLimits` key under the convention that governs it — the ONLY correct way to
 * interpret a limit, and the single place the two sentinel conventions are reconciled.
 *
 * - Ordinary keys: `0` / absent / negative = unlimited (what `usage.service.ts` has always done).
 * - {@link NEGATIVE_UNLIMITED_LIMIT_KEYS}: only a negative value is unlimited; `0` is a hard zero.
 *
 * **Absent, on an inverted key, resolves to zero — not unlimited.** It should be unreachable:
 * `mergePlans` folds catalogue defaults in per key so a newly-added key reaches existing
 * deployments, and `EntitlementService.getLimits` falls back to the compiled tier defaults rather
 * than a bare stub. If it happens anyway, refusing is the recoverable failure — a wrongly-refused
 * invite is a support ticket someone reports, a wrongly-granted seat is revenue leaking silently.
 */
export function resolvePlanLimit(
  limits: Partial<PlanLimits> | undefined,
  key: string,
): ResolvedPlanLimit {
  const inverted = NEGATIVE_UNLIMITED_LIMIT_KEYS.includes(key);
  const raw = limits?.[key];
  if (raw === undefined || Number.isNaN(raw)) {
    return inverted ? { value: 0, unlimited: false } : { value: 0, unlimited: true };
  }
  return inverted ? { value: raw, unlimited: raw < 0 } : { value: raw, unlimited: raw <= 0 };
}

/** The Entitlement Service's decision for one feature — what a client gates on. */
export interface EntitlementDecision {
  feature: PremiumFeature;
  status: EntitlementStatus;
  allowed: boolean;
  reason: EntitlementReason;
  /** When time-bounded access ends (trial/grace/temporary/promo), else null. */
  expiresAt: string | null;
  /** Remaining quota for a `limited` decision (null = not quota-bounded). */
  remaining: number | null;
  limit: number | null;
}

/** A user's full entitlement snapshot (the mobile client caches this). */
export interface EntitlementSnapshot {
  tier: PlanTier;
  status: EntitlementStatus;
  features: EntitlementDecision[];
  /** When the whole snapshot should be re-fetched (subscription period end / trial end). */
  refreshAt: string | null;
}

// ── Pure helpers ─────────────────────────────────────────────────────────────────

/** Ascending rank of a plan tier (free=0 … enterprise=3). */
export function planRank(tier: PlanTier): number {
  const rank = PLAN_TIER_ORDER.indexOf(tier);
  return rank < 0 ? 0 : rank;
}

/** Whether moving `from` → `to` is an upgrade (higher tier). */
export function isPlanUpgrade(from: PlanTier, to: PlanTier): boolean {
  return planRank(to) > planRank(from);
}

/** Whether moving `from` → `to` is a downgrade (lower tier). */
export function isPlanDowngrade(from: PlanTier, to: PlanTier): boolean {
  return planRank(to) < planRank(from);
}

/** Whether a subscription status still grants (full or degraded) premium access. */
export function subscriptionGrantsAccess(status: SubscriptionStatus): boolean {
  return ACCESS_GRANTING_SUBSCRIPTION_STATUSES.includes(status);
}

/** Whether an entitlement status permits using the capability. */
export function entitlementAllows(status: EntitlementStatus): boolean {
  return ACCESS_GRANTING_ENTITLEMENT_STATUSES.includes(status);
}

/**
 * Map a subscription status to the entitlement status it implies for an INCLUDED
 * feature (before overrides/quota). Kept pure + shared so backend decisions and
 * client hints agree.
 */
export function subscriptionStatusToEntitlement(status: SubscriptionStatus): EntitlementStatus {
  switch (status) {
    case SubscriptionStatus.Active:
      return EntitlementStatus.Allow;
    case SubscriptionStatus.Trialing:
      return EntitlementStatus.Trial;
    case SubscriptionStatus.GracePeriod:
    case SubscriptionStatus.PastDue:
      return EntitlementStatus.GracePeriod;
    case SubscriptionStatus.Paused:
      return EntitlementStatus.Paused;
    case SubscriptionStatus.PendingActivation:
      return EntitlementStatus.PendingActivation;
    case SubscriptionStatus.Canceled:
      return EntitlementStatus.Cancelled;
    case SubscriptionStatus.Expired:
      return EntitlementStatus.Expired;
    default:
      return EntitlementStatus.Deny;
  }
}

/** Credits consumed for a USD cost, at a credits-per-USD rate (ceil so free never rounds away). */
export function creditsForCostUsd(costUsd: number, creditsPerUsd: number): number {
  if (costUsd <= 0 || creditsPerUsd <= 0) return 0;
  return Math.max(1, Math.ceil(costUsd * creditsPerUsd));
}

/** Normalize a coupon code for lookup (upper-case, trimmed). */
export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Whether a coupon is redeemable at `now` given its window + active flag + caps. */
export function couponRedeemableAt(
  coupon: {
    active: boolean;
    startsAt: string | null;
    expiresAt: string | null;
    maxRedemptions: number;
    redemptions: number;
  },
  now: Date,
): boolean {
  if (!coupon.active) return false;
  if (coupon.startsAt !== null && new Date(coupon.startsAt).getTime() > now.getTime()) return false;
  if (coupon.expiresAt !== null && new Date(coupon.expiresAt).getTime() < now.getTime())
    return false;
  if (coupon.maxRedemptions > 0 && coupon.redemptions >= coupon.maxRedemptions) return false;
  return true;
}

// ── Guardrails (server clamps to these; also the shared contract for clients) ──────

/** Feature flag gating the whole monetization platform (pre-seeded, disabled). */
export const MONETIZATION_MASTER_FLAG_KEY = 'feature.payments.enabled';

/** Coupon-code bounds + character set (upper alphanumerics, dashes). */
export const COUPON_CODE_MIN = 3;
export const COUPON_CODE_MAX = 40;
export const COUPON_CODE_REGEX = /^[A-Z0-9][A-Z0-9-]{1,38}[A-Z0-9]$/;

/** Default credits granted per USD of AI spend converted to credits (100 = $0.01/credit). */
export const DEFAULT_CREDITS_PER_USD = 100;

/** Minimum credits a user may buy in one credit purchase. */
export const CREDIT_MIN_PURCHASE = 100;
export const CREDIT_MAX_PURCHASE = 1_000_000;

/** Default free-trial length (days) when a plan does not override it. */
export const DEFAULT_TRIAL_DAYS = 14;

/** Default dunning / grace window (days) after a failed renewal before access ends. */
export const DEFAULT_GRACE_PERIOD_DAYS = 7;

/** How long an entitlement decision is cached before recomputation (seconds). */
export const ENTITLEMENT_CACHE_TTL_SECONDS = 60;

/**
 * Default per-tier plan limits (org default; admin-configurable at runtime through the
 * `monetization.plans` setting, so these are the compiled fallback, not the law).
 *
 * `maxPieces` is B4's stock cap on live pieces (docs/45 §4.9) — generous enough to read as an
 * anti-abuse ceiling rather than a paywall, and `0` (unlimited) on the two paid-through tiers.
 *
 * `maxCollaborators` is B6's seat cap per story (docs/45 §4.11), charged to the plan of the author
 * who OWNS the story. **Its sentinel is inverted:** `UNLIMITED_SEATS` (-1) is unlimited and `0` is
 * none, because Free genuinely gets zero seats and `0` would otherwise read as unlimited. Never
 * copy `maxPieces`'s `0` across to it — see {@link NEGATIVE_UNLIMITED_LIMIT_KEYS}.
 */
export const DEFAULT_PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  [PlanTier.Free]: {
    aiDailyTokens: 20_000,
    aiMonthlyTokens: 200_000,
    aiMonthlyCredits: 0,
    maxPieces: 25,
    maxCollaborators: 0, // zero seats — solo. NOT "unlimited": this key's sentinel is -1.
  },
  [PlanTier.Plus]: {
    aiDailyTokens: 100_000,
    aiMonthlyTokens: 2_000_000,
    aiMonthlyCredits: 5_000,
    maxPieces: 250,
    maxCollaborators: 3,
  },
  [PlanTier.Pro]: {
    aiDailyTokens: 500_000,
    aiMonthlyTokens: 10_000_000,
    aiMonthlyCredits: 25_000,
    maxPieces: 0,
    maxCollaborators: UNLIMITED_SEATS, // -1, not 0 — 0 would mean "no collaborators" here.
  },
  [PlanTier.Enterprise]: {
    aiDailyTokens: 0,
    aiMonthlyTokens: 0,
    aiMonthlyCredits: 100_000,
    maxPieces: 0,
    maxCollaborators: UNLIMITED_SEATS,
  },
};

/** Which premium features each tier includes by default (admin config may override). */
export const DEFAULT_PLAN_FEATURES: Record<PlanTier, readonly PremiumFeature[]> = {
  [PlanTier.Free]: [PremiumFeature.AiBudget],
  [PlanTier.Plus]: [
    PremiumFeature.AiBudget,
    PremiumFeature.AiWriting,
    PremiumFeature.AiDiscovery,
    PremiumFeature.PremiumSearch,
  ],
  [PlanTier.Pro]: [
    PremiumFeature.AiBudget,
    PremiumFeature.AiWriting,
    PremiumFeature.AiDiscovery,
    PremiumFeature.StoryIntelligence,
    PremiumFeature.PremiumSearch,
    PremiumFeature.PremiumRecommendations,
    PremiumFeature.AdvancedAnalytics,
    PremiumFeature.PublishingPro,
  ],
  [PlanTier.Enterprise]: [
    PremiumFeature.AiBudget,
    PremiumFeature.AiWriting,
    PremiumFeature.AiDiscovery,
    PremiumFeature.StoryIntelligence,
    PremiumFeature.PremiumSearch,
    PremiumFeature.PremiumRecommendations,
    PremiumFeature.AdvancedAnalytics,
    PremiumFeature.PublishingPro,
  ],
};

/** Default supported billing/display currencies (ISO-4217, lower-cased on the wire). */
export const SUPPORTED_CURRENCIES = ['usd', 'eur', 'gbp', 'inr', 'pkr'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];
export const DEFAULT_CURRENCY: SupportedCurrency = 'usd';
