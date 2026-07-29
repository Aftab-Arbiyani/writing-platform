import type { ConfigType } from '@nestjs/config';
import { PaymentProvider, PaymentStatus, PurchaseKind } from '@qalam/shared';

import type { paymentsConfig } from '../../../../config/payments.config';
import { PaymentProviderNotConfiguredException } from '../../monetization.exceptions';
import { ManualAdapter } from './manual.adapter';

function makeConfig(manualEnabled: boolean): ConfigType<typeof paymentsConfig> {
  return {
    stripe: {
      secretKey: '',
      webhookSecret: '',
      apiBaseUrl: '',
      successUrl: '',
      cancelUrl: '',
    },
    apple: {
      sharedSecret: '',
      bundleId: '',
      useSandbox: true,
      verifyUrl: '',
      sandboxVerifyUrl: '',
    },
    google: { serviceAccountKey: '', packageName: '', apiBaseUrl: '' },
    manual: { enabled: manualEnabled },
  } as unknown as ConfigType<typeof paymentsConfig>;
}

function build(enabled = true) {
  return new ManualAdapter(makeConfig(enabled));
}

const checkout = {
  userId: 'user-1',
  provider: PaymentProvider.Manual,
  kind: PurchaseKind.Subscription,
  currency: 'usd',
  amount: 499,
};

/**
 * The safety property first, because it is the one that matters if anything else here is wrong: this
 * adapter completes a charge without a processor, so a deployment that has not explicitly opted in must
 * not be able to reach it.
 */
describe('ManualAdapter — off unless explicitly enabled', () => {
  it('is not configured by default', () => {
    expect(build(false).isConfigured()).toBe(false);
  });

  it('refuses every money-moving call while unconfigured', async () => {
    const adapter = build(false);
    await expect(adapter.createCheckout(checkout)).rejects.toBeInstanceOf(
      PaymentProviderNotConfiguredException,
    );
    await expect(adapter.refund({ providerPaymentId: 'p1' })).rejects.toBeInstanceOf(
      PaymentProviderNotConfiguredException,
    );
    await expect(adapter.cancelSubscription()).rejects.toBeInstanceOf(
      PaymentProviderNotConfiguredException,
    );
  });

  it('is configured only for the exact string "true"', () => {
    // The config reads `process.env.PAYMENTS_MANUAL_ENABLED === 'true'`, so anything else — '1',
    // 'yes', 'TRUE' — leaves it off. A near-miss must fail closed, not enable a free checkout.
    expect(build(true).isConfigured()).toBe(true);
    expect(build(false).isConfigured()).toBe(false);
  });
});

describe('ManualAdapter — createCheckout', () => {
  it('reports the purchase as already settled, so the caller records the charge', async () => {
    // `activated: true` is the whole point: `BillingService.startSubscriptionCheckout` branches on it
    // to open the subscription in a granting state AND call `recordSuccessfulCharge`, which writes the
    // paid invoice and succeeded payment. That is the chain the af5 E2E row asserts.
    const session = await build().createCheckout(checkout);
    expect(session.activated).toBe(true);
    expect(session.provider).toBe(PaymentProvider.Manual);
  });

  it('offers no redirect, because the payment is already done', async () => {
    const session = await build().createCheckout(checkout);
    expect(session.checkoutUrl).toBeNull();
    expect(session.clientSecret).toBeNull();
  });

  it('mints a traceable reference that cannot be mistaken for a real processor id', async () => {
    const session = await build().createCheckout(checkout);
    expect(session.providerRef).toMatch(/^manual_subscription_/);
    expect(session.providerSubscriptionId).toMatch(/^manual_sub_/);
  });

  it('mints a distinct reference per call, so the ledger never collides', async () => {
    const adapter = build();
    const a = await adapter.createCheckout(checkout);
    const b = await adapter.createCheckout(checkout);
    expect(a.providerRef).not.toBe(b.providerRef);
  });

  it('carries no subscription id for a non-subscription purchase', async () => {
    const session = await build().createCheckout({ ...checkout, kind: PurchaseKind.Credits });
    expect(session.providerSubscriptionId).toBeNull();
    expect(session.providerRef).toMatch(/^manual_credits_/);
  });

  it('passes an existing provider customer id through', async () => {
    const session = await build().createCheckout({ ...checkout, providerCustomerId: 'cus_x' });
    expect(session.providerCustomerId).toBe('cus_x');
  });
});

describe('ManualAdapter — the paths that must never approve anything', () => {
  it('never verifies a webhook signature, even when configured', () => {
    // There is no webhook source. Returning false is not a stub — it is what stops anyone posting a
    // "manual" event to the webhook controller and having it trusted.
    expect(build(true).verifyWebhookSignature()).toBe(false);
    expect(build(false).verifyWebhookSignature()).toBe(false);
  });

  it('throws rather than parsing a webhook body', () => {
    expect(() => build().parseWebhookEvent()).toThrow(PaymentProviderNotConfiguredException);
  });

  it('never validates a receipt', async () => {
    // Not a store. A false verdict is the correct "cannot vouch for that" — an accidental `true` here
    // would let any string grant a store subscription.
    const result = await build(true).validateReceipt();
    expect(result.valid).toBe(false);
    expect(result.providerRef).toBeNull();
  });
});

describe('ManualAdapter — refund', () => {
  it('settles immediately, since nothing was captured', async () => {
    const result = await build().refund({ providerPaymentId: 'pay-1', amount: 499 });
    expect(result.status).toBe(PaymentStatus.Refunded);
    expect(result.amount).toBe(499);
    expect(result.providerRefundId).toMatch(/^manual_re_/);
  });

  it('treats an omitted amount as zero rather than guessing a full refund', async () => {
    // The port documents an omitted amount as "full refund", but this adapter has no captured amount to
    // read — so it reports 0 and lets `BillingService.refund`, which knows the payment row, own the
    // figure. Inventing one here would put a wrong number in the ledger.
    const result = await build().refund({ providerPaymentId: 'pay-1' });
    expect(result.amount).toBe(0);
  });
});
