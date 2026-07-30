import type {
  BillingInterval,
  PaymentProvider,
  PaymentStatus,
  PlanTier,
  PurchaseKind,
} from '@qalam/shared';

/**
 * The payment-provider abstraction (AF5). Every provider (Stripe, Apple App Store,
 * Google Play, and any future one) implements this ONE port; business logic depends only
 * on the port, never on a provider SDK — so the provider is replaceable without an
 * architectural change (adding one = a new adapter class registered under the multi-token,
 * mirroring the AI platform's `AI_PROVIDER_ADAPTERS`). No provider SDK type leaks upward:
 * adapters translate provider payloads into these neutral shapes at the edge.
 */

/** What a checkout is starting. */
export interface CheckoutInput {
  userId: string;
  provider: PaymentProvider;
  kind: PurchaseKind;
  tier?: PlanTier;
  interval?: BillingInterval;
  /** Net amount to charge in minor units (after discounts), for one-time/credit buys. */
  amount?: number;
  currency: string;
  /** Provider product/price id when the provider prices server-side (Stripe price id). */
  providerPriceId?: string;
  /** Store purchase token/receipt when the client already completed a store purchase. */
  receipt?: string;
  /** The provider customer id, if the user already has one. */
  providerCustomerId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * The result of starting a checkout. For a redirect provider (Stripe) `checkoutUrl` is
 * set and activation completes via webhook. For a store provider the purchase already
 * happened on-device, so `activated` is true and `providerSubscriptionId`/`providerRef`
 * carry the verified ids.
 */
export interface CheckoutSession {
  provider: PaymentProvider;
  checkoutUrl: string | null;
  clientSecret: string | null;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  providerRef: string | null;
  /** True when access can be granted immediately (store purchase already verified). */
  activated: boolean;
}

/** A normalized provider webhook event (the adapter maps the provider's shape to this). */
export interface ProviderWebhookEvent {
  provider: PaymentProvider;
  /** Provider-native event id — the idempotency/replay key. */
  id: string;
  /** Normalized event type (e.g. `subscription.renewed`, `payment.failed`). */
  type: string;
  /** Raw provider event type (for audit). */
  rawType: string;
  userId: string | null;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  amount: number | null;
  currency: string | null;
  status: PaymentStatus | null;
  /** When the subscription's paid period ends (renewal advances this). */
  periodEnd: Date | null;
  payload: Record<string, unknown>;
}

/** A refund request. */
export interface RefundInput {
  providerPaymentId: string;
  /** Amount to refund in minor units; omit for a full refund. */
  amount?: number;
  reason?: string;
}

/** The outcome of a refund. */
export interface RefundResult {
  providerRefundId: string;
  amount: number;
  status: PaymentStatus;
}

/** The outcome of validating a store receipt / purchase token. */
export interface ReceiptValidation {
  valid: boolean;
  /** Provider-native transaction id (the dedupe key). */
  providerRef: string | null;
  productId: string | null;
  kind: PurchaseKind | null;
  /** Subscription paid-through date, for a subscription receipt. */
  expiresAt: Date | null;
  /** Whether the store still considers the subscription auto-renewing. */
  autoRenewing: boolean;
  raw: Record<string, unknown>;
}

/** One payment provider's adapter. */
export interface PaymentProviderAdapter {
  readonly provider: PaymentProvider;

  /** True only when credentials are present (blank secret => inert). */
  isConfigured(): boolean;

  /** Start a checkout for a subscription / one-time / credit purchase. */
  createCheckout(input: CheckoutInput): Promise<CheckoutSession>;

  /**
   * Verify a webhook's authenticity + freshness (HMAC signature + replay window). MUST
   * be called before trusting any webhook. Returns false on any mismatch/staleness.
   */
  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean;

  /** Parse a verified webhook body into the normalized event shape. */
  parseWebhookEvent(rawBody: string): ProviderWebhookEvent;

  /** Issue a (full or partial) refund. */
  refund(input: RefundInput): Promise<RefundResult>;

  /** Cancel the provider-side subscription (Stripe); store subs cancel on-device. */
  cancelSubscription(providerSubscriptionId: string): Promise<void>;

  /** Validate a store receipt / purchase token server-side (Apple/Google). */
  validateReceipt(receipt: string): Promise<ReceiptValidation>;
}

/** Multi-provider DI token — the array of registered adapters (mirrors AI_PROVIDER_ADAPTERS). */
export const PAYMENT_PROVIDER_ADAPTERS = Symbol('PAYMENT_PROVIDER_ADAPTERS');
