import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { PaymentProvider, PaymentStatus, PurchaseKind } from '@qalam/shared';

import { paymentsConfig } from '../../../../config/payments.config';
import { PaymentProviderNotConfiguredException } from '../../monetization.exceptions';
import type {
  CheckoutInput,
  CheckoutSession,
  PaymentProviderAdapter,
  ProviderWebhookEvent,
  ReceiptValidation,
  RefundInput,
  RefundResult,
} from '../payment-provider.port';

/**
 * The **manual** payment adapter (AF5) — a provider that completes a charge without moving money.
 *
 * `PaymentProvider.Manual` has been in `@qalam/shared` since AF5 shipped, documented as covering
 * "admin/comp grants", with **no implementation** — so the registry answered
 * `PAYMENT_PROVIDER_NOT_CONFIGURED` for it exactly like the three key-gated real providers. That gap
 * is what made "subscribe → entitlement granted" unassertable in any environment without third-party
 * credentials, and it is why the `af5` E2E row was green in only one half ([48 §3.6 W4-4]).
 *
 * ## Why this rather than a Stripe test key
 *
 * A Stripe test key was the alternative, and it loses on three counts:
 *
 * 1. **It is not hermetic.** `StripeAdapter.createCheckout` does a real `fetch` to `api.stripe.com`,
 *    so every E2E run would depend on a third party's availability and latency — a class of flake the
 *    suite has no defence against, in a suite whose whole value is that a red run means something.
 * 2. **It needs a secret in CI**, and a payment credential is the least appealing thing to add to a
 *    repo's secret set for the sake of a test.
 * 3. **It would not prove more of what the row is about.** The row asserts that a completed payment
 *    grants an entitlement — i.e. the Billing → Subscription → Entitlement chain. Stripe's own HTTP
 *    client and its webhook HMAC scheme are separately covered offline by `stripe.adapter.spec.ts`,
 *    which reproduces the real signature format. Routing E2E through Stripe would re-test the parts
 *    already tested and add a network dependency to the parts that are not.
 *
 * What this adapter deliberately does **not** cover: Stripe's redirect flow, its webhook path, and
 * provider-side subscription state. Those remain unasserted by the browser suite, and that is recorded
 * rather than papered over.
 *
 * ## Safety
 *
 * **Off unless explicitly switched on**, exactly like the three real providers — but gated on an
 * explicit boolean rather than a credential, because there is no credential to hold. With
 * `PAYMENTS_MANUAL_ENABLED` unset or anything other than `'true'`, `isConfigured()` is false and every
 * call throws `PAYMENT_PROVIDER_NOT_CONFIGURED`. A deployment that does not opt in cannot reach this
 * code, and the enabling env var is not something a client can influence.
 *
 * **This is a payment provider, not a comp-grant mechanism.** It records a real `Payment` row and a
 * paid `Invoice` at the plan's real price — that is the point, since exercising the payment ledger is
 * what the E2E row asserts — so switching it on in production would book revenue that was never
 * collected. Administrative comp access already has its own path that does not touch the ledger:
 * `POST /admin/monetization/overrides` (an entitlement override) and `POST /admin/monetization/credits/adjust`.
 * Use those for a real grant; use this for a stack that needs a working checkout without a processor.
 */
@Injectable()
export class ManualAdapter implements PaymentProviderAdapter {
  readonly provider = PaymentProvider.Manual;
  private readonly logger = new Logger(ManualAdapter.name);

  constructor(
    @Inject(paymentsConfig.KEY) private readonly config: ConfigType<typeof paymentsConfig>,
  ) {}

  isConfigured(): boolean {
    return this.config.manual.enabled;
  }

  /**
   * "Charge" immediately and report success.
   *
   * `activated: true` is what makes this useful: `BillingService.startSubscriptionCheckout` then opens
   * the subscription in a granting state AND calls `recordSuccessfulCharge`, which writes the paid
   * invoice and the succeeded payment. So one request produces the whole chain the `af5` row asserts —
   * subscription, payment, entitlement — with no redirect and no webhook to wait for.
   *
   * `checkoutUrl` is null for the same reason a store purchase's is: there is nowhere to send the
   * reader, because the payment is already done.
   */
  async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    this.assertConfigured();
    // A provider-shaped reference so the payment row is traceable to this adapter in the ledger, and
    // never mistakable for a real processor's id.
    const providerRef = `manual_${input.kind}_${randomUUID()}`;
    this.logger.warn(
      `manual payment provider settled ${input.kind} for user ${input.userId} ` +
        `(${String(input.amount ?? 0)} ${input.currency}) — no money moved`,
    );
    return {
      provider: this.provider,
      checkoutUrl: null,
      clientSecret: null,
      providerCustomerId: input.providerCustomerId ?? null,
      providerSubscriptionId:
        input.kind === PurchaseKind.Subscription ? `manual_sub_${randomUUID()}` : null,
      providerRef,
      activated: true,
    };
  }

  /**
   * There is no webhook source, so there is nothing to authenticate.
   *
   * Returning false unconditionally is the safe answer and not merely a stub: the webhook controller
   * refuses anything this rejects, so no caller can inject a "manual" event by posting one.
   */
  verifyWebhookSignature(): boolean {
    return false;
  }

  /** Unreachable — {@link verifyWebhookSignature} never lets a body through. */
  parseWebhookEvent(): ProviderWebhookEvent {
    throw new PaymentProviderNotConfiguredException(this.provider);
  }

  /**
   * Refunds settle immediately, because nothing was captured.
   *
   * Implemented rather than thrown so the admin refund path stays exercisable end to end on a stack
   * using this provider — a refund that cannot be tested is how a refund bug ships.
   */
  async refund(input: RefundInput): Promise<RefundResult> {
    this.assertConfigured();
    return {
      providerRefundId: `manual_re_${randomUUID()}`,
      amount: input.amount ?? 0,
      status: PaymentStatus.Refunded,
    };
  }

  /** Nothing is held provider-side, so cancellation is local-only and already done by the caller. */
  async cancelSubscription(): Promise<void> {
    this.assertConfigured();
  }

  /**
   * Not a store, so there is no receipt to validate.
   *
   * Answers `valid: false` rather than throwing: `validateReceipt` is called on the store paths, and a
   * false verdict is the correct, well-typed "this provider cannot vouch for that" — never an accidental
   * approval.
   */
  async validateReceipt(): Promise<ReceiptValidation> {
    return {
      valid: false,
      providerRef: null,
      productId: null,
      kind: null,
      expiresAt: null,
      autoRenewing: false,
      raw: {},
    };
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new PaymentProviderNotConfiguredException(this.provider);
    }
  }
}
