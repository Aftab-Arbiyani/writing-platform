import { createHmac } from 'node:crypto';

import type { ConfigType } from '@nestjs/config';

import { PaymentProvider, PurchaseKind } from '@qalam/shared';

import type { paymentsConfig } from '../../../../config/payments.config';
import { PaymentProviderNotConfiguredException } from '../../monetization.exceptions';
import { StripeAdapter } from './stripe.adapter';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a Stripe-style `stripe-signature` header using the real HMAC scheme. */
function buildStripeHeader(rawBody: string, secret: string, timestampOverride?: number): string {
  const t = timestampOverride ?? Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return `t=${t},v1=${sig}`;
}

/** Minimal payments config stub. */
function makeConfig(secretKey: string, webhookSecret: string): ConfigType<typeof paymentsConfig> {
  return {
    stripe: {
      secretKey,
      webhookSecret,
      apiBaseUrl: 'https://api.stripe.com/v1',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    },
    apple: {
      sharedSecret: '',
      bundleId: '',
      useSandbox: true,
      verifyUrl: '',
      sandboxVerifyUrl: '',
    },
    google: {
      serviceAccountKey: '',
      packageName: '',
      apiBaseUrl: '',
    },
  } as unknown as ConfigType<typeof paymentsConfig>;
}

// ── Factory ────────────────────────────────────────────────────────────────────

function build(secretKey = 'sk_test_abc', webhookSecret = 'whsec_test') {
  const adapter = new StripeAdapter(makeConfig(secretKey, webhookSecret));
  return { adapter };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('StripeAdapter', () => {
  afterEach(() => jest.clearAllMocks());

  describe('isConfigured', () => {
    it('should return true when secretKey is set', () => {
      const { adapter } = build('sk_test_real');

      expect(adapter.isConfigured()).toBe(true);
    });

    it('should return false when secretKey is blank', () => {
      const { adapter } = build('');

      expect(adapter.isConfigured()).toBe(false);
    });

    it('should return false when secretKey is only whitespace', () => {
      const { adapter } = build('   ');

      expect(adapter.isConfigured()).toBe(false);
    });
  });

  describe('verifyWebhookSignature', () => {
    const RAW_BODY = '{"id":"evt_1","type":"invoice.paid","data":{"object":{}}}';
    const WEBHOOK_SECRET = 'whsec_test_secret_key';

    it('should return true for a correctly signed request with a fresh timestamp', () => {
      const { adapter } = build('sk_test', WEBHOOK_SECRET);
      const header = buildStripeHeader(RAW_BODY, WEBHOOK_SECRET);

      expect(adapter.verifyWebhookSignature(RAW_BODY, { 'stripe-signature': header })).toBe(true);
    });

    it('should accept the header with an uppercase key (Stripe-Signature)', () => {
      const { adapter } = build('sk_test', WEBHOOK_SECRET);
      const header = buildStripeHeader(RAW_BODY, WEBHOOK_SECRET);

      expect(adapter.verifyWebhookSignature(RAW_BODY, { 'Stripe-Signature': header })).toBe(true);
    });

    it('should return false for a request with an incorrect signature', () => {
      const { adapter } = build('sk_test', WEBHOOK_SECRET);
      const t = Math.floor(Date.now() / 1000);
      const badHeader = `t=${t},v1=deadbeefdeadbeefdeadbeef00000000deadbeefdeadbeefdeadbeef00000000`;

      expect(adapter.verifyWebhookSignature(RAW_BODY, { 'stripe-signature': badHeader })).toBe(
        false,
      );
    });

    it('should return false for a request signed with a different secret', () => {
      const { adapter } = build('sk_test', WEBHOOK_SECRET);
      const header = buildStripeHeader(RAW_BODY, 'whsec_different_secret');

      expect(adapter.verifyWebhookSignature(RAW_BODY, { 'stripe-signature': header })).toBe(false);
    });

    it('should return false for a stale timestamp (> 300 seconds old)', () => {
      const { adapter } = build('sk_test', WEBHOOK_SECRET);
      const staleTimestamp = Math.floor(Date.now() / 1000) - 301; // 1 second beyond tolerance
      const header = buildStripeHeader(RAW_BODY, WEBHOOK_SECRET, staleTimestamp);

      expect(adapter.verifyWebhookSignature(RAW_BODY, { 'stripe-signature': header })).toBe(false);
    });

    it('should return false for a timestamp in the future beyond the tolerance window', () => {
      const { adapter } = build('sk_test', WEBHOOK_SECRET);
      const futureTimestamp = Math.floor(Date.now() / 1000) + 301;
      const header = buildStripeHeader(RAW_BODY, WEBHOOK_SECRET, futureTimestamp);

      expect(adapter.verifyWebhookSignature(RAW_BODY, { 'stripe-signature': header })).toBe(false);
    });

    it('should return false when the stripe-signature header is missing', () => {
      const { adapter } = build('sk_test', WEBHOOK_SECRET);

      expect(adapter.verifyWebhookSignature(RAW_BODY, {})).toBe(false);
    });

    it('should return false when the signature header exists but has no t= part', () => {
      const { adapter } = build('sk_test', WEBHOOK_SECRET);

      expect(
        adapter.verifyWebhookSignature(RAW_BODY, {
          'stripe-signature': 'v1=abc123',
        }),
      ).toBe(false);
    });

    it('should return false when webhookSecret is blank (regardless of header)', () => {
      const { adapter } = build('sk_test', ''); // no webhook secret configured
      const t = Math.floor(Date.now() / 1000);
      const header = `t=${t},v1=doesnotmatter`;

      expect(adapter.verifyWebhookSignature(RAW_BODY, { 'stripe-signature': header })).toBe(false);
    });

    it('should still return true for a timestamp within the tolerance window (e.g. 299 s ago)', () => {
      const { adapter } = build('sk_test', WEBHOOK_SECRET);
      const recentTimestamp = Math.floor(Date.now() / 1000) - 299;
      const header = buildStripeHeader(RAW_BODY, WEBHOOK_SECRET, recentTimestamp);

      expect(adapter.verifyWebhookSignature(RAW_BODY, { 'stripe-signature': header })).toBe(true);
    });
  });

  describe('createCheckout', () => {
    it('should throw PaymentProviderNotConfiguredException when secretKey is blank', async () => {
      const { adapter } = build('', 'whsec_test'); // not configured

      await expect(
        adapter.createCheckout({
          userId: 'u1',
          provider: PaymentProvider.Stripe,
          kind: PurchaseKind.Subscription,
          currency: 'usd',
          amount: 499,
        }),
      ).rejects.toBeInstanceOf(PaymentProviderNotConfiguredException);
    });
  });

  describe('parseWebhookEvent', () => {
    it('should normalize invoice.paid to subscription.renewed', () => {
      const { adapter } = build();
      const raw = JSON.stringify({
        id: 'evt_1',
        type: 'invoice.paid',
        data: {
          object: {
            customer: 'cus_abc',
            subscription: 'sub_abc',
            amount_paid: 499,
            currency: 'usd',
            current_period_end: Math.floor(Date.now() / 1000) + 30 * 86_400,
            metadata: { userId: 'u1' },
          },
        },
      });

      const event = adapter.parseWebhookEvent(raw);

      expect(event.type).toBe('subscription.renewed');
      expect(event.rawType).toBe('invoice.paid');
      expect(event.userId).toBe('u1');
      expect(event.provider).toBe(PaymentProvider.Stripe);
    });

    it('should normalize customer.subscription.deleted to subscription.canceled', () => {
      const { adapter } = build();
      const raw = JSON.stringify({
        id: 'evt_2',
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_abc', customer: 'cus_abc', metadata: {} } },
      });

      const event = adapter.parseWebhookEvent(raw);

      expect(event.type).toBe('subscription.canceled');
    });

    it('should normalize invoice.payment_failed to payment.failed', () => {
      const { adapter } = build();
      const raw = JSON.stringify({
        id: 'evt_3',
        type: 'invoice.payment_failed',
        data: { object: { customer: 'cus_abc', metadata: {} } },
      });

      const event = adapter.parseWebhookEvent(raw);

      expect(event.type).toBe('payment.failed');
    });
  });
});
