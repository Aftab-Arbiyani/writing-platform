import type {
  OverrideEffect,
  PlanDefinition,
  PlanTier,
  PremiumFeature,
  PromotionType,
} from '@qalam/shared';

/**
 * Wire shapes for the admin monetization surface (A1, docs/45 §5).
 *
 * Declared here rather than imported from `@qalam/api-types` because that package carries the
 * USER-facing monetization contract only — subscription, entitlements, usage, credits, invoices,
 * payments, plans, coupon validation. It has no admin shapes: no coupon record, no entitlement
 * override, no resolved config, and none of the three analytics payloads. This mirrors what
 * `features/operations/types` does for P7.4.
 *
 * Every one of these is READ from a frozen backend (`admin-monetization.controller.ts`). The types
 * follow the controller's mappers exactly; where a field is nullable here it is nullable there.
 */

/** `GET /admin/monetization/plans` — the RESOLVED catalogue (stored folded over compiled defaults). */
export type AdminPlanCatalogue = Record<PlanTier, PlanDefinition>;

/**
 * `GET/PATCH /admin/monetization/config` — the cross-cutting config.
 *
 * All seven fields are readable and writable (B8 closed A1-2). Each table MERGES per key
 * server-side, so a patch adds and overwrites keys but never removes one — the config form says so
 * where the operator can act on it.
 */
export interface AdminMonetizationConfig {
  creditsPerUsd: number;
  trialDays: number;
  gracePeriodDays: number;
  lowCreditThreshold: number;
  /** Region → tax rate as a FRACTION (0.2 = 20%), plus a `default` key. */
  taxRates: Record<string, number>;
  /** Currency → multiplier against USD (`usd: 1`). */
  currencyRates: Record<string, number>;
  regionCurrency: Record<string, string>;
}

/** `UpdateMonetizationConfigDto` — every field optional; the tables merge per key. */
export interface AdminMonetizationConfigPatch {
  creditsPerUsd?: number;
  trialDays?: number;
  gracePeriodDays?: number;
  lowCreditThreshold?: number;
  taxRates?: Record<string, number>;
  currencyRates?: Record<string, number>;
  regionCurrency?: Record<string, string>;
}

/** `GET /admin/monetization/overrides/:userId` — `toEntitlementOverrideDto`. */
export interface AdminEntitlementOverride {
  id: string;
  userId: string;
  feature: PremiumFeature;
  effect: OverrideEffect;
  active: boolean;
  expiresAt: string | null;
  reason: string | null;
  createdAt: string;
}

/** `POST /admin/monetization/overrides` — `GrantOverrideDto`. */
export interface GrantOverridePayload {
  userId: string;
  feature: PremiumFeature;
  effect: OverrideEffect;
  /** ISO date the grant lapses. Omit for a permanent override. */
  expiresAt?: string;
  reason?: string;
  /** Free-text provenance, e.g. `promotional` / `support` / `temporary`. */
  source?: string;
  limit?: number;
}

// ── Coupons (A1b) ─────────────────────────────────────────────────────────────

/**
 * `GET/POST/PATCH /admin/monetization/coupons` — `toCouponDto`.
 *
 * `appliesToTier`, `perUserLimit` and `description` come back since B8 (A1-4), so every field the
 * create form sets can be read back and checked.
 */
export interface AdminCoupon {
  id: string;
  code: string;
  type: PromotionType;
  value: number;
  active: boolean;
  redemptions: number;
  /** 0 = unlimited total redemptions. */
  maxRedemptions: number;
  /** Per-user redemption cap. */
  perUserLimit: number;
  /** Tier restriction; null = any tier. */
  appliesToTier: PlanTier | null;
  campaign: string | null;
  description: string | null;
  expiresAt: string | null;
  createdAt: string;
}

/** `CreateCouponDto`. `code`, `type` and `value` are required; the rest are optional. */
export interface CreateCouponPayload {
  code: string;
  type: PromotionType;
  value: number;
  appliesToTier?: PlanTier;
  maxRedemptions?: number;
  perUserLimit?: number;
  campaign?: string;
  description?: string;
  expiresAt?: string;
}

/** `UpdateCouponDto` — every field optional; `code` and `type` are immutable after creation. */
export interface UpdateCouponPayload {
  active?: boolean;
  value?: number;
  maxRedemptions?: number;
  description?: string;
  expiresAt?: string;
}

// ── Credits + refunds (A1b) ───────────────────────────────────────────────────

/** `AdjustCreditsDto` — positive grants, negative deducts. */
export interface AdjustCreditsPayload {
  userId: string;
  amount: number;
  reason?: string;
}

/**
 * `POST credits/adjust` response — `{ userId, balance }`.
 *
 * `balance` is the balance AFTER the adjustment, and it is post-CLAMP: `CreditService.apply` floors
 * the wallet at zero, so a deduction larger than the balance succeeds and lands on 0 rather than
 * raising `INSUFFICIENT_CREDITS`. **That clamp is unchanged by B8 and deliberately so** — over-spend
 * is prevented upstream by the usage meter's quota check, and turning a currently-succeeding admin
 * deduction into an error is a behaviour change no row has asked for. Since the balance is now
 * readable (`AdminUserCredits`), the confirmation projects the clamped result rather than guessing.
 */
export interface CreditAdjustResult {
  userId: string;
  balance: number;
}

// ── One account (B8) ──────────────────────────────────────────────────────────

/**
 * `GET /admin/monetization/users/:userId/subscription`.
 *
 * `subscription` is `null` when the account is on free — a normal state, not a 404, so the screen
 * renders a calm answer rather than an error banner. Note the limit this shape carries: an unknown
 * user id looks exactly like a real free account, because the monetization module holds no user
 * table to check against (docs/48 §3, B8-1).
 */
export interface AdminUserSubscription {
  userId: string;
  subscription: AdminSubscription | null;
}

/** `toSubscriptionDto` — the same shape the account holder's own route returns. */
export interface AdminSubscription {
  id: string;
  tier: PlanTier;
  status: string;
  interval: string;
  provider: string;
  currency: string;
  autoRenew: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  gracePeriodEnd: string | null;
  canceledAt: string | null;
  scheduledTier: string | null;
  scheduledInterval: string | null;
  createdAt: string;
}

/**
 * `GET /admin/monetization/users/:userId/credits`.
 *
 * `credits` is `null` when no wallet row has ever existed, so the effective balance is 0. The route
 * is a pure read — unlike the account holder's own, it does not create a wallet on first look.
 */
export interface AdminUserCredits {
  userId: string;
  credits: AdminCreditBalance | null;
}

/** `toCreditBalanceDto`. */
export interface AdminCreditBalance {
  balance: number;
  lifetimeGranted: number;
  lifetimeConsumed: number;
  creditsPerUsd: number;
  updatedAt: string;
}

/** One page of `GET /admin/monetization/users/:userId/payments` (keyset, newest first). */
export interface AdminPaymentPage {
  items: AdminPayment[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** `RefundDto` — omit `amount` for a full refund. */
export interface RefundPayload {
  amount?: number;
  reason?: string;
}

/** `POST payments/:id/refund` — `toPaymentDto`. The refund row, with a negative `amount`. */
export interface AdminPayment {
  id: string;
  provider: string;
  method: string | null;
  status: string;
  amount: number;
  currency: string;
  description: string | null;
  createdAt: string;
}

// ── Analytics (A1c) ───────────────────────────────────────────────────────────

/**
 * `GET /admin/monetization/analytics/revenue`.
 *
 * Two figures of different quality, and the dashboard treats them differently. `byCurrency` (B8,
 * closing A1-6) is grouped, so each row is money in ONE unit and can be printed with its currency.
 * The four scalars still sum ACROSS currencies — they predate the grouping and keep their exact
 * meaning, because retyping a shipped field is what §8 of the freeze forbids.
 */
export interface RevenueAnalytics {
  totalRevenue: number;
  last30dRevenue: number;
  /** Absolute value of refunded payments (the service already flips the sign). */
  refunded: number;
  /** Count of SUCCEEDED payment rows — the only field that proves whether any data exists. */
  paymentsCount: number;
  /** Per-currency breakdown, highest total first. Amounts are minor units OF THAT CURRENCY. */
  byCurrency: RevenueByCurrency[];
}

/** One currency's slice of the revenue overview — addable, unlike the scalars above. */
export interface RevenueByCurrency {
  currency: string;
  totalRevenue: number;
  last30dRevenue: number;
  refunded: number;
  paymentsCount: number;
}

/** `GET /admin/monetization/analytics/subscriptions`. */
export interface SubscriptionAnalytics {
  /** GROUP BY status. Empty when no subscription has ever existed. */
  byStatus: Record<string, number>;
  byTier: Record<string, number>;
  activeCount: number;
  trialingCount: number;
  last30d: { created: number; upgraded: number; downgraded: number; canceled: number };
}

/** `GET /admin/monetization/analytics/usage` — AI tokens, credits and cost. */
export interface UsageAnalytics {
  totalTokens: number;
  totalCreditsConsumed: number;
  totalCostUsd: number;
  last30dCostUsd: number;
  byFeature: Array<{ feature: string; tokens: number; costUsd: number }>;
}
