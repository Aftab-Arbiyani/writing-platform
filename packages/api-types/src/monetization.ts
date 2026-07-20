/**
 * Monetization Platform wire contract (AF5 — Subscriptions, Entitlements, AI Usage,
 * Payments, Credits, Promotions, Pricing).
 *
 * The request/response shapes over `/api/v1/monetization/*`, `/api/v1/billing/*`, and
 * the `/api/v1/admin/monetization/*` surface. The provider-agnostic VOCABULARY (plan
 * tiers, statuses, entitlement decisions, payment/invoice/credit enums) lives in
 * `@qalam/shared` and is re-exported here so a client imports everything monetization-
 * related from one package. Handwritten until the backend emits `openapi.json` (same
 * policy as `./ai`, `./story`, `./retrieval`).
 *
 * Server-authoritative: the client renders entitlement/subscription state as a HINT and
 * always defers to a fresh server response. Purchase validation is never trusted from the
 * client — receipts/tokens are verified server-side.
 */
export type {
  BillingInterval,
  CreditEntryType,
  CreditReason,
  EntitlementDecision,
  EntitlementReason,
  EntitlementSnapshot,
  EntitlementStatus,
  InvoiceStatus,
  OverrideEffect,
  PaymentMethodType,
  PaymentProvider,
  PaymentStatus,
  PlanDefinition,
  PlanLimits,
  PlanTier,
  PremiumFeature,
  PromotionType,
  PurchaseKind,
  PurchaseStatus,
  QuotaWindow,
  SubscriptionEventType,
  SubscriptionStatus,
  UsageMetric,
} from '@qalam/shared';

import type {
  BillingInterval,
  CreditReason,
  EntitlementSnapshot,
  InvoiceStatus,
  PaymentMethodType,
  PaymentProvider,
  PaymentStatus,
  PlanDefinition,
  PlanTier,
  PremiumFeature,
  PurchaseKind,
  PurchaseStatus,
  QuotaWindow,
  SubscriptionStatus,
} from '@qalam/shared';

// ── Subscription ─────────────────────────────────────────────────────────────

/** A user's subscription as returned by `GET /monetization/subscription`. */
export interface SubscriptionResponse {
  id: string;
  tier: PlanTier;
  status: SubscriptionStatus;
  interval: BillingInterval;
  provider: PaymentProvider;
  currency: string;
  autoRenew: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  gracePeriodEnd: string | null;
  canceledAt: string | null;
  /** A scheduled future plan change (downgrade/interval switch), else null. */
  scheduledTier: PlanTier | null;
  scheduledInterval: BillingInterval | null;
  createdAt: string;
}

/** `POST /monetization/subscription` — start a checkout for a paid plan. */
export interface CreateSubscriptionRequest {
  tier: PlanTier;
  interval: BillingInterval;
  provider: PaymentProvider;
  couponCode?: string;
  /** Store purchase token (Apple/Google) when provider is a store; Stripe uses checkout. */
  receipt?: string;
}

/** `POST /monetization/subscription/change` — upgrade/downgrade or switch interval. */
export interface ChangePlanRequest {
  tier: PlanTier;
  interval: BillingInterval;
  /** When true, a downgrade schedules for period end; an upgrade is immediate + prorated. */
  atPeriodEnd?: boolean;
  couponCode?: string;
}

/** The result of starting a checkout — either a redirect URL (Stripe) or a done flag (store). */
export interface CheckoutResponse {
  subscription: SubscriptionResponse;
  /** Provider-hosted checkout URL to open (Stripe); null when already activated (store). */
  checkoutUrl: string | null;
  clientSecret: string | null;
}

/** `POST /monetization/subscription/cancel`. */
export interface CancelSubscriptionRequest {
  /** Cancel at period end (default) vs immediately. */
  immediate?: boolean;
  reason?: string;
}

/** One entry of subscription history (`GET /monetization/subscription/history`). */
export interface SubscriptionEventResponse {
  id: string;
  type: string;
  fromTier: PlanTier | null;
  toTier: PlanTier | null;
  fromStatus: SubscriptionStatus | null;
  toStatus: SubscriptionStatus | null;
  createdAt: string;
}

// ── Entitlements ───────────────────────────────────────────────────────────────

/** `GET /monetization/entitlements` — the full server-authoritative snapshot. */
export type EntitlementsResponse = EntitlementSnapshot;

/** `GET /monetization/entitlements/:feature` — one feature's decision. */
export interface FeatureEntitlementResponse {
  feature: PremiumFeature;
  allowed: boolean;
  status: string;
  reason: string;
  expiresAt: string | null;
  remaining: number | null;
  limit: number | null;
}

// ── Usage & credits ──────────────────────────────────────────────────────────

/** A usage roll-up over one window (`GET /monetization/usage`). */
export interface UsageWindowResponse {
  window: QuotaWindow;
  tokens: number;
  credits: number;
  requests: number;
  costUsd: number;
  tokenLimit: number | null;
  creditLimit: number | null;
  usedFraction: number | null;
  resetsAt: string | null;
}

/** The full usage picture + a simple forecast. */
export interface UsageSummaryResponse {
  daily: UsageWindowResponse;
  monthly: UsageWindowResponse;
  total: UsageWindowResponse;
  byFeature: Array<{ feature: string; tokens: number; credits: number; requests: number }>;
  /** Linear projection of monthly token spend to period end. */
  forecastMonthlyTokens: number;
  forecastMonthlyCostUsd: number;
}

/** Credit wallet balance (`GET /monetization/credits`). */
export interface CreditBalanceResponse {
  balance: number;
  lifetimeGranted: number;
  lifetimeConsumed: number;
  creditsPerUsd: number;
  updatedAt: string;
}

/** One credit-ledger entry (`GET /monetization/credits/transactions`). */
export interface CreditTransactionResponse {
  id: string;
  type: string;
  reason: CreditReason;
  delta: number;
  balanceAfter: number;
  feature: string | null;
  tokens: number;
  costUsd: number;
  createdAt: string;
}

/** `POST /monetization/credits/purchase` — buy a credit pack. */
export interface PurchaseCreditsRequest {
  credits: number;
  provider: PaymentProvider;
  receipt?: string;
}

// ── Payments / invoices / purchases ─────────────────────────────────────────────

/** A billing document (`GET /monetization/invoices`). */
export interface InvoiceResponse {
  id: string;
  number: string;
  status: InvoiceStatus;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string | null;
  hostedUrl: string | null;
  pdfUrl: string | null;
  createdAt: string;
}

/** A payment ledger row (`GET /monetization/payments`). */
export interface PaymentResponse {
  id: string;
  provider: PaymentProvider;
  method: PaymentMethodType;
  status: PaymentStatus;
  amount: number;
  currency: string;
  description: string | null;
  createdAt: string;
}

/** `POST /monetization/purchases/restore` — re-grant from a store receipt. */
export interface RestorePurchasesRequest {
  provider: PaymentProvider;
  receipt: string;
}

/** Result of a purchase restore. */
export interface RestorePurchasesResponse {
  restored: number;
  subscription: SubscriptionResponse | null;
  creditsGranted: number;
}

/** One purchase record. */
export interface PurchaseResponse {
  id: string;
  kind: PurchaseKind;
  status: PurchaseStatus;
  provider: PaymentProvider;
  amount: number;
  currency: string;
  creditsGranted: number;
  createdAt: string;
}

// ── Pricing / plans / promotions ─────────────────────────────────────────────────

/** `GET /monetization/plans` — the public plan catalogue for the comparison screen. */
export interface PlansResponse {
  plans: PlanDefinition[];
  currency: string;
  /** Region resolved from the request (currency + tax) — a hint for the client. */
  region: string | null;
}

/** `POST /monetization/coupons/validate` — preview a coupon before checkout. */
export interface ValidateCouponRequest {
  code: string;
  tier?: PlanTier;
  interval?: BillingInterval;
}

/** The preview result for a coupon. */
export interface ValidateCouponResponse {
  code: string;
  valid: boolean;
  type: string;
  /** Discounted amount in minor units (cents) if applicable, else null. */
  discountedAmount: number | null;
  description: string;
}
