import { createHash } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { PaymentProvider, PurchaseKind } from '@qalam/shared';

import { paymentsConfig } from '../../../../config/payments.config';
import {
  PaymentProviderNotConfiguredException,
  ReceiptValidationFailedException,
} from '../../monetization.exceptions';
import type {
  CheckoutInput,
  CheckoutSession,
  PaymentProviderAdapter,
  ProviderWebhookEvent,
  ReceiptValidation,
  RefundResult,
} from '../payment-provider.port';

/** Apple's status code meaning "sandbox receipt sent to production" → retry sandbox. */
const APPLE_SANDBOX_STATUS = 21007;

/**
 * Apple App Store adapter (AF5) — server-side StoreKit receipt validation via the
 * `verifyReceipt` endpoint (fetch, no SDK). Key-gated on the App Store shared secret.
 * A store purchase completes ON DEVICE; the client sends the receipt, the server
 * validates it (NEVER trusting the client), and grants access. Handles the 21007
 * sandbox-vs-production retry Apple mandates.
 *
 * App Store Server Notifications (webhooks) arrive as a signed JWS; full x5c
 * certificate-chain verification is the production hardening step (documented seam) —
 * this adapter verifies the notification is structurally a signed payload and processes
 * the decoded transaction. Signature material is never trusted without configuration.
 */
@Injectable()
export class AppleAdapter implements PaymentProviderAdapter {
  readonly provider = PaymentProvider.AppleAppStore;
  private readonly logger = new Logger(AppleAdapter.name);

  constructor(
    @Inject(paymentsConfig.KEY) private readonly config: ConfigType<typeof paymentsConfig>,
  ) {}

  isConfigured(): boolean {
    return this.config.apple.sharedSecret.trim() !== '';
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    // The purchase already happened on-device; "checkout" here means verify + activate.
    if (input.receipt === undefined || input.receipt === '') {
      throw new ReceiptValidationFailedException('An App Store receipt is required.');
    }
    const validation = await this.validateReceipt(input.receipt);
    if (!validation.valid) {
      throw new ReceiptValidationFailedException();
    }
    return {
      provider: this.provider,
      checkoutUrl: null,
      clientSecret: null,
      providerCustomerId: null,
      providerSubscriptionId: validation.providerRef,
      providerRef: validation.providerRef,
      activated: true,
    };
  }

  verifyWebhookSignature(rawBody: string): boolean {
    if (!this.isConfigured()) {
      return false;
    }
    try {
      const parsed = JSON.parse(rawBody) as { signedPayload?: string };
      // A genuine App Store Server Notification v2 is a JWS (`header.payload.sig`).
      return (
        typeof parsed.signedPayload === 'string' && parsed.signedPayload.split('.').length === 3
      );
    } catch {
      return false;
    }
  }

  parseWebhookEvent(rawBody: string): ProviderWebhookEvent {
    const parsed = JSON.parse(rawBody) as { signedPayload?: string };
    const claims = decodeJwsClaims(parsed.signedPayload ?? '');
    const notificationType = String(claims.notificationType ?? 'unknown');
    return {
      provider: this.provider,
      id: String(claims.notificationUUID ?? createHash('sha256').update(rawBody).digest('hex')),
      type: normalizeAppleType(notificationType),
      rawType: notificationType,
      userId: null,
      providerCustomerId: null,
      providerSubscriptionId: null,
      amount: null,
      currency: null,
      status: null,
      periodEnd: null,
      payload: claims,
    };
  }

  refund(): Promise<RefundResult> {
    // App Store refunds are issued by Apple (customer support), not via a server API.
    return Promise.reject(
      new ReceiptValidationFailedException('App Store refunds are handled by Apple.'),
    );
  }

  cancelSubscription(): Promise<void> {
    // Store subscriptions are cancelled by the user in their Apple account; the server
    // reflects it on the next renewal notification. Nothing to call.
    return Promise.resolve();
  }

  async validateReceipt(receipt: string): Promise<ReceiptValidation> {
    if (!this.isConfigured()) {
      throw new PaymentProviderNotConfiguredException(this.provider);
    }
    const body = {
      'receipt-data': receipt,
      password: this.config.apple.sharedSecret,
      'exclude-old-transactions': true,
    };
    let response = await this.verify(this.config.apple.verifyUrl, body);
    if (response.status === APPLE_SANDBOX_STATUS) {
      response = await this.verify(this.config.apple.sandboxVerifyUrl, body);
    }
    if (response.status !== 0) {
      return emptyValidation();
    }
    const latest = (response.latest_receipt_info ?? [])
      .slice()
      .sort((a, b) => Number(b.expires_date_ms ?? 0) - Number(a.expires_date_ms ?? 0))[0];
    if (latest === undefined) {
      return emptyValidation();
    }
    const expiresMs = Number(latest.expires_date_ms ?? 0);
    return {
      valid: true,
      providerRef: latest.original_transaction_id ?? latest.transaction_id ?? null,
      productId: latest.product_id ?? null,
      kind: expiresMs > 0 ? PurchaseKind.Subscription : PurchaseKind.OneTime,
      expiresAt: expiresMs > 0 ? new Date(expiresMs) : null,
      autoRenewing: (response.pending_renewal_info ?? [])[0]?.auto_renew_status === '1',
      raw: response as unknown as Record<string, unknown>,
    };
  }

  private async verify(url: string, body: unknown): Promise<AppleVerifyResponse> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
      return (await response.json()) as AppleVerifyResponse;
    } catch (error) {
      this.logger.error(`Apple verifyReceipt failed: ${String(error)}`);
      throw new ReceiptValidationFailedException();
    }
  }
}

interface AppleVerifyResponse {
  status: number;
  latest_receipt_info?: Array<{
    product_id?: string;
    transaction_id?: string;
    original_transaction_id?: string;
    expires_date_ms?: string;
  }>;
  pending_renewal_info?: Array<{ auto_renew_status?: string }>;
}

function emptyValidation(): ReceiptValidation {
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

/** Decode a JWS payload (base64url middle segment) without verifying — parse only. */
function decodeJwsClaims(jws: string): Record<string, unknown> {
  const segments = jws.split('.');
  if (segments.length !== 3) {
    return {};
  }
  try {
    return JSON.parse(Buffer.from(segments[1] ?? '', 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
}

function normalizeAppleType(type: string): string {
  switch (type) {
    case 'DID_RENEW':
      return 'subscription.renewed';
    case 'EXPIRED':
      return 'subscription.canceled';
    case 'DID_FAIL_TO_RENEW':
      return 'payment.failed';
    case 'REFUND':
      return 'payment.refunded';
    default:
      return type;
  }
}
