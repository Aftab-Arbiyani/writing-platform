import { registerAs } from '@nestjs/config';

/**
 * Payment/monetization config (AF5). Provider credentials are SECRETS — env only, never
 * a default that could leak a real key, never sent to a client. A provider with a blank
 * secret is treated as "not configured" (its adapter reports unavailable and calls fail
 * `PAYMENT_PROVIDER_NOT_CONFIGURED`), so the whole billing subsystem is inert until keys
 * are supplied — matching the disabled `feature.payments.enabled` flag and mirroring how
 * the AI provider adapters are key-gated (ai.config.ts).
 *
 * The payment provider is replaceable without an architectural change: adding a provider
 * is a new adapter + its credentials here, nothing else.
 */
export const paymentsConfig = registerAs('payments', () => ({
  /** Stripe (card/checkout/webhooks). Blank secretKey => Stripe not configured. */
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    /** Signing secret for webhook HMAC verification (`whsec_…`). */
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    apiBaseUrl: process.env.STRIPE_API_BASE_URL ?? 'https://api.stripe.com/v1',
    /** Where the provider-hosted checkout returns the user. */
    successUrl: process.env.STRIPE_SUCCESS_URL ?? '',
    cancelUrl: process.env.STRIPE_CANCEL_URL ?? '',
  },
  /** Apple App Store (StoreKit receipt validation). */
  apple: {
    /** App Store shared secret for the verifyReceipt endpoint. Blank => not configured. */
    sharedSecret: process.env.APPLE_SHARED_SECRET ?? '',
    /** iOS app bundle id the receipt must match. */
    bundleId: process.env.APPLE_BUNDLE_ID ?? '',
    /** Use the sandbox verify endpoint (development builds). */
    useSandbox: (process.env.APPLE_USE_SANDBOX ?? 'true') === 'true',
    verifyUrl: process.env.APPLE_VERIFY_URL ?? 'https://buy.itunes.apple.com/verifyReceipt',
    sandboxVerifyUrl:
      process.env.APPLE_SANDBOX_VERIFY_URL ?? 'https://sandbox.itunes.apple.com/verifyReceipt',
  },
  /**
   * The **manual** provider — settles a charge without a processor (`ManualAdapter`).
   *
   * Gated on an explicit boolean rather than a credential, because there is none to hold; the effect is
   * the same as a blank secret elsewhere in this file, which is that the provider is inert until a
   * deployment opts in. **Off by default, and it must stay that way in production**: it records a real
   * payment + paid invoice at the plan's real price, so enabling it books revenue nobody collected.
   * Its purpose is a stack that needs a working checkout without a processor — the E2E stack. Real
   * comp grants go through `/admin/monetization/overrides`, which does not touch the ledger.
   */
  manual: {
    enabled: process.env.PAYMENTS_MANUAL_ENABLED === 'true',
  },
  /** Google Play Billing (purchase-token validation via Play Developer API). */
  google: {
    /** Service-account JSON (or its access token) for the Play Developer API. Blank => off. */
    serviceAccountKey: process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY ?? '',
    packageName: process.env.GOOGLE_PLAY_PACKAGE_NAME ?? '',
    apiBaseUrl: process.env.GOOGLE_PLAY_API_BASE_URL ?? 'https://androidpublisher.googleapis.com',
  },
}));
