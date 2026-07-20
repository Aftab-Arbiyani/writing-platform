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

/**
 * Google Play Billing adapter (AF5) — server-side purchase-token validation via the Play
 * Developer API (fetch, no SDK). Key-gated on the service-account credential. A store
 * purchase completes on-device; the client sends `{ productId, purchaseToken }`, the
 * server validates it against Google (NEVER trusting the client) and grants access.
 *
 * Real-time Developer Notifications (webhooks) arrive via Cloud Pub/Sub push, whose OIDC
 * transport authenticates the sender (there is no per-message HMAC to verify) — so
 * `verifyWebhookSignature` gates on configuration + structural validity and the Pub/Sub
 * subscription's OIDC audience is the production authenticity control (documented seam).
 *
 * NOTE: `serviceAccountKey` is treated as a ready OAuth2 access token for the Play API;
 * minting one by JWT-signing the service-account key is the documented production step.
 */
@Injectable()
export class GooglePlayAdapter implements PaymentProviderAdapter {
  readonly provider = PaymentProvider.GooglePlay;
  private readonly logger = new Logger(GooglePlayAdapter.name);

  constructor(
    @Inject(paymentsConfig.KEY) private readonly config: ConfigType<typeof paymentsConfig>,
  ) {}

  isConfigured(): boolean {
    return this.config.google.serviceAccountKey.trim() !== '';
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    if (input.receipt === undefined || input.receipt === '') {
      throw new ReceiptValidationFailedException('A Google Play purchase token is required.');
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
      const parsed = JSON.parse(rawBody) as { message?: { data?: string } };
      return typeof parsed.message?.data === 'string';
    } catch {
      return false;
    }
  }

  parseWebhookEvent(rawBody: string): ProviderWebhookEvent {
    const parsed = JSON.parse(rawBody) as { message?: { data?: string; messageId?: string } };
    const decoded = decodePubSubData(parsed.message?.data ?? '');
    const sub = decoded.subscriptionNotification as
      { notificationType?: number; subscriptionId?: string; purchaseToken?: string } | undefined;
    return {
      provider: this.provider,
      id: String(parsed.message?.messageId ?? createHash('sha256').update(rawBody).digest('hex')),
      type: normalizeGoogleType(sub?.notificationType),
      rawType: `google.${sub?.notificationType ?? 'unknown'}`,
      userId: null,
      providerCustomerId: null,
      providerSubscriptionId: sub?.purchaseToken ?? null,
      amount: null,
      currency: null,
      status: null,
      periodEnd: null,
      payload: decoded,
    };
  }

  refund(): Promise<RefundResult> {
    return Promise.reject(
      new ReceiptValidationFailedException('Google Play refunds are handled in the Play Console.'),
    );
  }

  cancelSubscription(): Promise<void> {
    return Promise.resolve();
  }

  async validateReceipt(receipt: string): Promise<ReceiptValidation> {
    if (!this.isConfigured()) {
      throw new PaymentProviderNotConfiguredException(this.provider);
    }
    const { productId, purchaseToken } = parseReceipt(receipt);
    if (productId === '' || purchaseToken === '') {
      throw new ReceiptValidationFailedException('Malformed Google Play receipt.');
    }
    const url =
      `${this.config.google.apiBaseUrl}/androidpublisher/v3/applications/` +
      `${this.config.google.packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`;
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${this.config.google.serviceAccountKey}` },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) {
        return emptyValidation();
      }
      const body = (await response.json()) as {
        expiryTimeMillis?: string;
        autoRenewing?: boolean;
        orderId?: string;
      };
      const expiresMs = Number(body.expiryTimeMillis ?? 0);
      return {
        valid: expiresMs > Date.now(),
        providerRef: body.orderId ?? purchaseToken,
        productId,
        kind: PurchaseKind.Subscription,
        expiresAt: expiresMs > 0 ? new Date(expiresMs) : null,
        autoRenewing: body.autoRenewing === true,
        raw: body as Record<string, unknown>,
      };
    } catch (error) {
      this.logger.error(`Google Play validation failed: ${String(error)}`);
      throw new ReceiptValidationFailedException();
    }
  }
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

/** A Play receipt is a JSON string `{ productId, purchaseToken }`. */
function parseReceipt(receipt: string): { productId: string; purchaseToken: string } {
  try {
    const parsed = JSON.parse(receipt) as { productId?: string; purchaseToken?: string };
    return { productId: parsed.productId ?? '', purchaseToken: parsed.purchaseToken ?? '' };
  } catch {
    return { productId: '', purchaseToken: '' };
  }
}

function decodePubSubData(data: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(data, 'base64').toString('utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function normalizeGoogleType(notificationType: number | undefined): string {
  switch (notificationType) {
    case 2: // SUBSCRIPTION_RENEWED
    case 4: // SUBSCRIPTION_PURCHASED
      return 'subscription.renewed';
    case 3: // SUBSCRIPTION_CANCELED
    case 13: // SUBSCRIPTION_EXPIRED
      return 'subscription.canceled';
    case 12: // SUBSCRIPTION_ON_HOLD
      return 'payment.failed';
    default:
      return `google.${notificationType ?? 'unknown'}`;
  }
}
