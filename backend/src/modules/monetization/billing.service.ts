import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  InvoiceStatus,
  PaymentProvider,
  PaymentStatus,
  PurchaseKind,
  WebhookEventStatus,
} from '@qalam/shared';
import type { BillingInterval, PlanTier } from '@qalam/shared';
import { Repository } from 'typeorm';

import type { CursorPayload } from '../../common/pagination/cursor.util';
import { DomainEventBus } from '../../common/events/domain-event-bus';
import { DomainEventType } from '../../common/events/domain-events';
import { JOB } from '../../common/queue/queue.constants';
import { JOB_ENQUEUER } from '../../common/queue/job-enqueuer.port';
import type { JobEnqueuer } from '../../common/queue/job-enqueuer.port';
import { AuditService } from '../audit/audit.service';
import type { SettingsActor } from '../settings/settings.util';
import { InvoiceService } from './invoice.service';
import { MONETIZATION_AUDIT_ACTIONS, MONETIZATION_AUDIT_TARGET } from './monetization.constants';
import {
  PaymentNotFoundException,
  WebhookSignatureInvalidException,
} from './monetization.exceptions';
import { Payment } from './entities/payment.entity';
import { PaymentWebhookEvent } from './entities/payment-webhook-event.entity';
import { PaymentRegistryService } from './payments/payment-registry.service';
import type { ProviderWebhookEvent } from './payments/payment-provider.port';
import { PricingService } from './pricing.service';
import { PromotionService } from './promotion.service';
import { SubscriptionService } from './subscription.service';
import { Subscription } from './entities/subscription.entity';
import { TaxService } from './tax.service';

/** A subscription-checkout request (already validated + monetization-enabled). */
export interface StartCheckoutInput {
  userId: string;
  tier: PlanTier;
  interval: BillingInterval;
  provider: PaymentProvider;
  couponCode?: string;
  receipt?: string;
  region?: string | null;
  providerCustomerId?: string | null;
}

/** The result of starting a checkout. */
export interface CheckoutResult {
  subscription: Subscription;
  checkoutUrl: string | null;
  clientSecret: string | null;
}

/**
 * The Billing service (AF5) — owns PAYMENT PROCESSING: it drives the provider abstraction
 * (checkout, refunds) and ingests + processes provider webhooks, translating them into
 * subscription-lifecycle calls. It NEVER couples business logic to a provider SDK (all
 * provider work goes through the port + registry) and NEVER trusts a client: every webhook
 * is signature-verified and replay-protected (unique provider event id) before any effect,
 * and processing is idempotent + async-capable (enqueued when a queue is wired, processed
 * inline otherwise). The Subscription service owns the row transitions this calls.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(PaymentWebhookEvent)
    private readonly webhooks: Repository<PaymentWebhookEvent>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(Subscription) private readonly subscriptions: Repository<Subscription>,
    private readonly registry: PaymentRegistryService,
    private readonly pricing: PricingService,
    private readonly promotions: PromotionService,
    private readonly subscriptionService: SubscriptionService,
    private readonly invoices: InvoiceService,
    private readonly tax: TaxService,
    private readonly audit: AuditService,
    private readonly bus: DomainEventBus,
    @Optional() @Inject(JOB_ENQUEUER) private readonly jobs?: JobEnqueuer,
  ) {}

  /** Start a subscription checkout: price → provider checkout → open the subscription row. */
  async startSubscriptionCheckout(input: StartCheckoutInput): Promise<CheckoutResult> {
    const currency = await this.pricing.currencyForRegion(input.region ?? null);
    const price = await this.pricing.computeCheckout(
      input.tier,
      input.interval,
      currency,
      input.couponCode,
    );
    const adapter = this.registry.get(input.provider);
    const session = await adapter.createCheckout({
      userId: input.userId,
      provider: input.provider,
      kind: PurchaseKind.Subscription,
      tier: input.tier,
      interval: input.interval,
      amount: price.net,
      currency,
      receipt: input.receipt,
      providerCustomerId: input.providerCustomerId ?? null,
    });

    const subscription = await this.subscriptionService.open({
      userId: input.userId,
      tier: input.tier,
      interval: input.interval,
      provider: input.provider,
      currency,
      providerCustomerId: session.providerCustomerId,
      providerSubscriptionId: session.providerSubscriptionId,
      activate: session.activated,
      allowTrial: input.couponCode === undefined,
    });

    if (session.activated) {
      // Store purchase already paid → record the payment + a paid invoice immediately.
      await this.recordSuccessfulCharge(
        input.userId,
        input.provider,
        price.net,
        currency,
        subscription.id,
        session.providerRef,
      );
    }
    if (input.couponCode !== undefined && input.couponCode !== '') {
      await this.tryRedeemCoupon(input.userId, input.couponCode, subscription.id);
    }
    return { subscription, checkoutUrl: session.checkoutUrl, clientSecret: session.clientSecret };
  }

  /** Cursor-paginated payment history for a user (newest first). */
  async listPayments(
    userId: string,
    cursor: CursorPayload | null,
    limit: number,
  ): Promise<Payment[]> {
    const qb = this.payments
      .createQueryBuilder('p')
      .where('p.user_id = :userId', { userId })
      .orderBy('p.created_at', 'DESC')
      .addOrderBy('p.id', 'DESC')
      .limit(limit + 1);
    if (cursor !== null) {
      qb.andWhere('(p.created_at, p.id) < (:ck::timestamptz, :cid::uuid)', {
        ck: cursor.k,
        cid: cursor.id,
      });
    }
    return qb.getMany();
  }

  /** Refund a payment (admin). Records a negative payment row + audits. */
  async refund(
    paymentId: string,
    actor: SettingsActor,
    amount?: number,
    reason?: string,
  ): Promise<Payment> {
    const original = await this.payments.findOne({ where: { id: paymentId } });
    if (original === null || original.providerPaymentId === null) {
      throw new PaymentNotFoundException();
    }
    const result = await this.registry
      .get(original.provider)
      .refund({ providerPaymentId: original.providerPaymentId, amount, reason });
    const refund = await this.payments.save(
      this.payments.create({
        userId: original.userId,
        provider: original.provider,
        providerPaymentId: result.providerRefundId,
        status: PaymentStatus.Refunded,
        method: original.method,
        amount: -Math.abs(result.amount),
        currency: original.currency,
        subscriptionId: original.subscriptionId,
        invoiceId: original.invoiceId,
        description: reason ?? 'Refund',
        failureReason: null,
        metadata: { refundOf: original.id },
      }),
    );
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: MONETIZATION_AUDIT_ACTIONS.PaymentRefund,
      targetId: original.id,
      targetType: MONETIZATION_AUDIT_TARGET.Payment,
      metadata: { amount: result.amount, reason },
      context: { ip: actor.ip, userAgent: actor.userAgent, requestId: actor.requestId },
    });
    return refund;
  }

  /**
   * Ingest a provider webhook: verify the signature (+ replay window), persist the event
   * idempotently (unique provider event id), and hand it off for async processing (enqueue
   * when a queue is wired, else process inline). Returns the recorded status.
   */
  async ingestWebhook(
    provider: PaymentProvider,
    rawBody: string,
    headers: Record<string, string>,
  ): Promise<{ status: WebhookEventStatus; id: string | null }> {
    const adapter = this.registry.getUnchecked(provider);
    if (adapter === undefined || !adapter.isConfigured()) {
      throw new WebhookSignatureInvalidException();
    }
    if (!adapter.verifyWebhookSignature(rawBody, headers)) {
      throw new WebhookSignatureInvalidException();
    }
    const event = adapter.parseWebhookEvent(rawBody);

    // Replay protection: the unique (provider, providerEventId) index makes a duplicate a
    // no-op. Check first for a fast path, then rely on the constraint under races.
    const existing = await this.webhooks.findOne({
      where: { provider, providerEventId: event.id },
    });
    if (existing !== null) {
      return { status: WebhookEventStatus.Duplicate, id: existing.id };
    }
    let record: PaymentWebhookEvent;
    try {
      record = await this.webhooks.save(
        this.webhooks.create({
          provider,
          providerEventId: event.id,
          type: event.rawType,
          signatureValid: true,
          status: WebhookEventStatus.Received,
          processedAt: null,
          error: null,
          payload: event.payload,
        }),
      );
    } catch {
      return { status: WebhookEventStatus.Duplicate, id: null }; // lost the unique-index race
    }

    if (this.jobs !== undefined) {
      await this.jobs.enqueue(JOB.MonetizationWebhook, { webhookEventId: record.id });
    } else {
      await this.processWebhookEvent(record.id);
    }
    return { status: WebhookEventStatus.Received, id: record.id };
  }

  /** Process one persisted webhook event → apply its subscription/payment effect (idempotent). */
  async processWebhookEvent(webhookEventId: string): Promise<void> {
    const record = await this.webhooks.findOne({ where: { id: webhookEventId } });
    if (record === null || record.status === WebhookEventStatus.Processed) {
      return;
    }
    const adapter = this.registry.getUnchecked(record.provider);
    if (adapter === undefined) {
      return;
    }
    const event = adapter.parseWebhookEvent(JSON.stringify(record.payload));
    try {
      await this.applyWebhookEffect(event);
      record.status = WebhookEventStatus.Processed;
      record.processedAt = new Date();
      record.error = null;
    } catch (error) {
      record.status = WebhookEventStatus.Failed;
      record.error = (error as Error).message.slice(0, 500);
      this.logger.error(`webhook ${webhookEventId} failed: ${String(error)}`);
    }
    await this.webhooks.save(record);
  }

  // ── Internals ────────────────────────────────────────────────────────────────

  private async applyWebhookEffect(event: ProviderWebhookEvent): Promise<void> {
    const userId = await this.resolveUser(event);
    if (userId === null) {
      return; // event for an unknown/foreign subscription — ignore safely
    }
    switch (event.type) {
      case 'subscription.renewed': {
        const subscription = await this.subscriptionService.renew(userId, event.periodEnd);
        await this.recordSuccessfulCharge(
          userId,
          event.provider,
          event.amount ?? 0,
          event.currency ?? subscription.currency,
          subscription.id,
          event.id,
        );
        break;
      }
      case 'payment.failed': {
        await this.subscriptionService.enterGracePeriod(userId);
        await this.payments.save(
          this.payments.create({
            userId,
            provider: event.provider,
            providerPaymentId: event.id,
            status: PaymentStatus.Failed,
            amount: event.amount ?? 0,
            currency: event.currency ?? 'usd',
            failureReason: 'renewal_failed',
            metadata: {},
          }),
        );
        await this.bus.emit(DomainEventType.PaymentFailed, {
          userId,
          amount: event.amount ?? 0,
          currency: event.currency ?? 'usd',
          reason: 'renewal_failed',
        });
        break;
      }
      case 'subscription.canceled': {
        const subscription = await this.subscriptionService.findByUser(userId);
        if (subscription !== null) {
          await this.subscriptionService.expire(subscription);
        }
        break;
      }
      default:
        // subscription.updated / payment.refunded / unknown → recorded, no lifecycle change.
        break;
    }
  }

  private async recordSuccessfulCharge(
    userId: string,
    provider: PaymentProvider,
    amount: number,
    currency: string,
    subscriptionId: string,
    providerPaymentId: string | null,
  ): Promise<void> {
    const subscription = await this.subscriptions.findOne({ where: { id: subscriptionId } });
    const region = null;
    const taxResult = await this.tax.computeTax(amount, region);
    const invoice = await this.invoices.create({
      userId,
      subscriptionId,
      provider,
      currency,
      subtotal: amount,
      tax: taxResult.tax,
      status: InvoiceStatus.Paid,
      periodStart: subscription?.currentPeriodStart ?? null,
      periodEnd: subscription?.currentPeriodEnd ?? null,
      lineItems: [{ description: 'Subscription', amount, quantity: 1 }],
    });
    const payment = await this.payments.save(
      this.payments.create({
        userId,
        provider,
        providerPaymentId,
        status: PaymentStatus.Succeeded,
        amount: amount + taxResult.tax,
        currency,
        subscriptionId,
        invoiceId: invoice.id,
        description: 'Subscription payment',
        metadata: {},
      }),
    );
    await this.bus.emit(DomainEventType.PaymentSucceeded, {
      userId,
      paymentId: payment.id,
      amount: payment.amount,
      currency,
      invoiceId: invoice.id,
    });
  }

  private async resolveUser(event: ProviderWebhookEvent): Promise<string | null> {
    if (event.userId !== null) {
      return event.userId;
    }
    if (event.providerSubscriptionId !== null) {
      const sub = await this.subscriptions.findOne({
        where: { providerSubscriptionId: event.providerSubscriptionId },
      });
      if (sub !== null) {
        return sub.userId;
      }
    }
    if (event.providerCustomerId !== null) {
      const sub = await this.subscriptions.findOne({
        where: { providerCustomerId: event.providerCustomerId },
      });
      if (sub !== null) {
        return sub.userId;
      }
    }
    return null;
  }

  private async tryRedeemCoupon(
    userId: string,
    code: string,
    subscriptionId: string,
  ): Promise<void> {
    try {
      await this.promotions.redeem(userId, code, subscriptionId);
    } catch (error) {
      this.logger.warn(`coupon redeem failed for ${userId}: ${(error as Error).message}`);
    }
  }
}
