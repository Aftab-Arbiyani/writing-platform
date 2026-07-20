import { createHmac, timingSafeEqual } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { PaymentProvider, PaymentStatus, PurchaseKind } from '@qalam/shared';

import { paymentsConfig } from '../../../../config/payments.config';
import {
  PaymentProviderErrorException,
  PaymentProviderNotConfiguredException,
} from '../../monetization.exceptions';
import type {
  CheckoutInput,
  CheckoutSession,
  PaymentProviderAdapter,
  ProviderWebhookEvent,
  ReceiptValidation,
  RefundInput,
  RefundResult,
} from '../payment-provider.port';

/** Stripe signature freshness window (seconds) — rejects replays outside it. */
const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * Stripe adapter (AF5) — a thin fetch-based HTTP client (no Stripe SDK, matching the AI
 * provider adapters). Key-gated: a blank `secretKey` => `isConfigured() === false` and
 * every call throws `PAYMENT_PROVIDER_NOT_CONFIGURED`, so Stripe is inert until keys land.
 *
 * The webhook signature verification is REAL and unit-testable offline: it reproduces
 * Stripe's `t=…,v1=…` scheme — HMAC-SHA256 over `${timestamp}.${rawBody}` with the
 * webhook signing secret, compared in constant time, with a replay-tolerance window. The
 * client MUST pass the UNPARSED raw body (the controller reads it before JSON parsing).
 */
@Injectable()
export class StripeAdapter implements PaymentProviderAdapter {
  readonly provider = PaymentProvider.Stripe;
  private readonly logger = new Logger(StripeAdapter.name);

  constructor(
    @Inject(paymentsConfig.KEY) private readonly config: ConfigType<typeof paymentsConfig>,
  ) {}

  isConfigured(): boolean {
    return this.config.stripe.secretKey.trim() !== '';
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    this.assertConfigured();
    const isSubscription = input.tier !== undefined && input.kind === PurchaseKind.Subscription;
    const params: Record<string, string> = {
      mode: isSubscription ? 'subscription' : 'payment',
      'metadata[userId]': input.userId,
      'metadata[kind]': input.kind,
      success_url: this.config.stripe.successUrl || 'https://qalam.example/billing/success',
      cancel_url: this.config.stripe.cancelUrl || 'https://qalam.example/billing/cancel',
    };
    if (input.providerCustomerId != null) {
      params.customer = input.providerCustomerId;
    }
    if (input.providerPriceId !== undefined && input.providerPriceId !== '') {
      params['line_items[0][price]'] = input.providerPriceId;
      params['line_items[0][quantity]'] = '1';
    } else {
      // Ad-hoc price for a one-time / credit purchase (no pre-created Stripe price).
      params['line_items[0][price_data][currency]'] = input.currency;
      params['line_items[0][price_data][unit_amount]'] = String(input.amount ?? 0);
      params['line_items[0][price_data][product_data][name]'] = `Qalam ${input.kind}`;
      params['line_items[0][quantity]'] = '1';
    }

    const session = await this.post<{ id: string; url: string | null; customer: string | null }>(
      '/checkout/sessions',
      params,
    );
    return {
      provider: this.provider,
      checkoutUrl: session.url,
      clientSecret: null,
      providerCustomerId: session.customer,
      providerSubscriptionId: null,
      providerRef: session.id,
      activated: false,
    };
  }

  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean {
    const secret = this.config.stripe.webhookSecret;
    if (secret.trim() === '') {
      return false;
    }
    const header = headers['stripe-signature'] ?? headers['Stripe-Signature'] ?? '';
    const parts = new Map(
      header.split(',').map((kv) => {
        const idx = kv.indexOf('=');
        return [kv.slice(0, idx).trim(), kv.slice(idx + 1).trim()] as const;
      }),
    );
    const timestamp = parts.get('t');
    const signature = parts.get('v1');
    if (timestamp === undefined || signature === undefined) {
      return false;
    }
    // Replay protection: reject signatures outside the tolerance window.
    const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
    if (!Number.isFinite(age) || age > STRIPE_SIGNATURE_TOLERANCE_SECONDS) {
      return false;
    }
    const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
    return safeEqualHex(expected, signature);
  }

  parseWebhookEvent(rawBody: string): ProviderWebhookEvent {
    const event = JSON.parse(rawBody) as StripeEvent;
    const object = event.data?.object ?? {};
    const metadata = (object.metadata ?? {}) as Record<string, string>;
    return {
      provider: this.provider,
      id: event.id,
      type: normalizeStripeType(event.type),
      rawType: event.type,
      userId: metadata.userId ?? null,
      providerCustomerId: (object.customer as string | undefined) ?? null,
      providerSubscriptionId:
        (object.subscription as string | undefined) ??
        (event.type.startsWith('customer.subscription') ? (object.id as string) : null),
      amount: typeof object.amount_paid === 'number' ? object.amount_paid : null,
      currency: (object.currency as string | undefined) ?? null,
      status: mapStripeStatus(event.type),
      periodEnd:
        typeof object.current_period_end === 'number'
          ? new Date(object.current_period_end * 1000)
          : null,
      payload: event as unknown as Record<string, unknown>,
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    this.assertConfigured();
    const params: Record<string, string> = { payment_intent: input.providerPaymentId };
    if (input.amount !== undefined) {
      params.amount = String(input.amount);
    }
    const refund = await this.post<{ id: string; amount: number; status: string }>(
      '/refunds',
      params,
    );
    return {
      providerRefundId: refund.id,
      amount: refund.amount,
      status: refund.status === 'succeeded' ? PaymentStatus.Refunded : PaymentStatus.Pending,
    };
  }

  async cancelSubscription(providerSubscriptionId: string): Promise<void> {
    this.assertConfigured();
    await this.request('DELETE', `/subscriptions/${providerSubscriptionId}`);
  }

  validateReceipt(): Promise<ReceiptValidation> {
    // Stripe is a redirect/webhook provider — there is no on-device receipt to validate.
    return Promise.resolve({
      valid: false,
      providerRef: null,
      productId: null,
      kind: null,
      expiresAt: null,
      autoRenewing: false,
      raw: {},
    });
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new PaymentProviderNotConfiguredException(this.provider);
    }
  }

  private post<T>(path: string, params: Record<string, string>): Promise<T> {
    return this.request<T>('POST', path, new URLSearchParams(params).toString());
  }

  private async request<T>(method: string, path: string, body?: string): Promise<T> {
    try {
      const response = await fetch(`${this.config.stripe.apiBaseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.config.stripe.secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: AbortSignal.timeout(20_000),
      });
      const json = (await response.json()) as T & { error?: { message?: string } };
      if (!response.ok) {
        throw new PaymentProviderErrorException(json.error?.message ?? `Stripe ${response.status}`);
      }
      return json;
    } catch (error) {
      if (error instanceof PaymentProviderErrorException) {
        throw error;
      }
      this.logger.error(`Stripe request failed: ${String(error)}`);
      throw new PaymentProviderErrorException();
    }
  }
}

interface StripeEvent {
  id: string;
  type: string;
  data?: { object?: Record<string, unknown> };
}

/** Constant-time hex comparison guarding against timing attacks + length mismatch. */
function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length || bufA.length === 0) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/** Map a raw Stripe event type to the normalized cross-provider vocabulary. */
function normalizeStripeType(type: string): string {
  switch (type) {
    case 'invoice.paid':
    case 'invoice.payment_succeeded':
      return 'subscription.renewed';
    case 'invoice.payment_failed':
      return 'payment.failed';
    case 'customer.subscription.deleted':
      return 'subscription.canceled';
    case 'customer.subscription.updated':
      return 'subscription.updated';
    case 'charge.refunded':
      return 'payment.refunded';
    case 'charge.dispute.created':
      return 'payment.disputed';
    default:
      return type;
  }
}

function mapStripeStatus(type: string): PaymentStatus | null {
  if (type === 'invoice.paid' || type === 'invoice.payment_succeeded') {
    return PaymentStatus.Succeeded;
  }
  if (type === 'invoice.payment_failed') {
    return PaymentStatus.Failed;
  }
  if (type === 'charge.refunded') {
    return PaymentStatus.Refunded;
  }
  if (type === 'charge.dispute.created') {
    return PaymentStatus.Disputed;
  }
  return null;
}
