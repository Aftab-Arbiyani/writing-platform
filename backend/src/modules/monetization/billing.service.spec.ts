import { PaymentProvider, PaymentStatus, WebhookEventStatus } from '@qalam/shared';
import type { Repository } from 'typeorm';

import type { DomainEventBus } from '../../common/events/domain-event-bus';
import type { AuditService } from '../audit/audit.service';
import { BillingService } from './billing.service';
import type { Payment } from './entities/payment.entity';
import type { PaymentWebhookEvent } from './entities/payment-webhook-event.entity';
import type { Subscription } from './entities/subscription.entity';
import type { InvoiceService } from './invoice.service';
import type { MonetizationConfigService } from './monetization.config-service';
import {
  PaymentNotFoundException,
  WebhookSignatureInvalidException,
} from './monetization.exceptions';
import type { PaymentProviderAdapter } from './payments/payment-provider.port';
import type { PaymentRegistryService } from './payments/payment-registry.service';
import type { PricingService } from './pricing.service';
import type { PromotionService } from './promotion.service';
import type { SubscriptionService } from './subscription.service';
import type { TaxService } from './tax.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeWebhookRecord(overrides?: Partial<PaymentWebhookEvent>): PaymentWebhookEvent {
  return {
    id: 'wh-1',
    provider: PaymentProvider.Stripe,
    providerEventId: 'evt_test_1',
    type: 'customer.subscription.updated',
    signatureValid: true,
    status: WebhookEventStatus.Received,
    processedAt: null,
    error: null,
    payload: {},
    createdAt: new Date(),
    ...overrides,
  } as unknown as PaymentWebhookEvent;
}

function makeProviderEvent(type = 'subscription.updated') {
  return {
    provider: PaymentProvider.Stripe,
    id: 'evt_test_1',
    type,
    rawType: 'customer.subscription.updated',
    userId: 'u1',
    providerCustomerId: null,
    providerSubscriptionId: null,
    amount: null,
    currency: null,
    status: null,
    periodEnd: null,
    payload: {},
  };
}

// ── Factory ────────────────────────────────────────────────────────────────────

function build(opts?: {
  /** Override individual adapter methods. */
  adapterOverrides?: Partial<PaymentProviderAdapter>;
  /** Webhook record returned by the duplicate-check findOne. null = not a duplicate. */
  existingWebhook?: PaymentWebhookEvent | null;
}) {
  const adapter: PaymentProviderAdapter = {
    provider: PaymentProvider.Stripe,
    isConfigured: jest.fn().mockReturnValue(true),
    verifyWebhookSignature: jest.fn().mockReturnValue(true),
    parseWebhookEvent: jest.fn().mockReturnValue(makeProviderEvent()),
    createCheckout: jest.fn(),
    refund: jest.fn(),
    cancelSubscription: jest.fn(),
    validateReceipt: jest.fn(),
    ...(opts?.adapterOverrides ?? {}),
  } as unknown as PaymentProviderAdapter;

  const registry = {
    getUnchecked: jest.fn().mockReturnValue(adapter),
    get: jest.fn().mockReturnValue(adapter),
  } as unknown as PaymentRegistryService;

  const existingWebhook = opts?.existingWebhook !== undefined ? opts.existingWebhook : null;
  const webhooks = {
    findOne: jest.fn().mockResolvedValue(existingWebhook),
    create: jest.fn().mockImplementation((data: unknown) => ({
      ...(data as object),
      id: 'wh-1',
    })),
    save: jest.fn().mockImplementation((entity: unknown) => Promise.resolve(entity)),
  } as unknown as Repository<PaymentWebhookEvent>;

  const payments = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((data: unknown) => ({ ...(data as object), id: 'pay-1' })),
    save: jest.fn().mockImplementation((entity: unknown) => Promise.resolve(entity)),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    }),
  } as unknown as Repository<Payment>;

  const subscriptions = {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation((entity: unknown) => Promise.resolve(entity)),
  } as unknown as Repository<Subscription>;

  const pricing = {
    currencyForRegion: jest.fn().mockResolvedValue('usd'),
    computeCheckout: jest.fn().mockResolvedValue({ amount: 499, discount: 0, net: 499 }),
  } as unknown as PricingService;

  const promotions = {
    redeem: jest.fn().mockResolvedValue({ coupon: {}, benefit: 0 }),
  } as unknown as PromotionService;

  const subscriptionService = {
    open: jest.fn().mockResolvedValue({ id: 'sub-1', userId: 'u1' }),
    renew: jest.fn().mockResolvedValue({
      id: 'sub-1',
      userId: 'u1',
      currency: 'usd',
      currentPeriodStart: null,
      currentPeriodEnd: null,
    }),
    activate: jest.fn().mockResolvedValue({ id: 'sub-1' }),
    enterGracePeriod: jest.fn().mockResolvedValue({ id: 'sub-1' }),
    findByUser: jest.fn().mockResolvedValue(null),
    expire: jest.fn().mockResolvedValue({ id: 'sub-1' }),
  } as unknown as SubscriptionService;

  const invoices = {
    create: jest.fn().mockResolvedValue({ id: 'inv-1' }),
  } as unknown as InvoiceService;

  const tax = {
    computeTax: jest.fn().mockResolvedValue({ tax: 0, rate: 0 }),
  } as unknown as TaxService;

  const audit = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;

  const bus = {
    emit: jest.fn().mockResolvedValue(undefined),
  } as unknown as DomainEventBus;

  const monetizationConfig = {} as unknown as MonetizationConfigService;

  const service = new BillingService(
    webhooks,
    payments,
    subscriptions,
    registry,
    pricing,
    promotions,
    subscriptionService,
    invoices,
    tax,
    audit,
    bus,
    // jobs (optional — omit so the service processes webhooks inline)
  );

  void monetizationConfig; // suppress unused warning

  return {
    service,
    adapter,
    registry,
    webhooks,
    payments,
    subscriptions,
    subscriptionService,
    bus,
    audit,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('BillingService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('ingestWebhook', () => {
    it('should throw WebhookSignatureInvalidException when verifyWebhookSignature returns false', async () => {
      const { service } = build({
        adapterOverrides: { verifyWebhookSignature: jest.fn().mockReturnValue(false) },
      });

      await expect(
        service.ingestWebhook(PaymentProvider.Stripe, '{}', { 'stripe-signature': 'bad' }),
      ).rejects.toBeInstanceOf(WebhookSignatureInvalidException);
    });

    it('should throw WebhookSignatureInvalidException when the adapter is not configured', async () => {
      const { service } = build({
        adapterOverrides: { isConfigured: jest.fn().mockReturnValue(false) },
      });

      await expect(service.ingestWebhook(PaymentProvider.Stripe, '{}', {})).rejects.toBeInstanceOf(
        WebhookSignatureInvalidException,
      );
    });

    it('should throw WebhookSignatureInvalidException when no adapter is found for the provider', async () => {
      const { service, registry } = build();
      (registry.getUnchecked as jest.Mock).mockReturnValue(undefined);

      await expect(service.ingestWebhook(PaymentProvider.Stripe, '{}', {})).rejects.toBeInstanceOf(
        WebhookSignatureInvalidException,
      );
    });

    it('should return status=duplicate and the existing id when the event was already received', async () => {
      const existing = makeWebhookRecord({
        id: 'wh-existing',
        status: WebhookEventStatus.Processed,
      });
      const { service } = build({ existingWebhook: existing });

      const result = await service.ingestWebhook(PaymentProvider.Stripe, '{}', {});

      expect(result.status).toBe(WebhookEventStatus.Duplicate);
      expect(result.id).toBe('wh-existing');
    });

    it('should return status=received and persist the event when it is new', async () => {
      const { service, webhooks } = build({ existingWebhook: null });

      const result = await service.ingestWebhook(
        PaymentProvider.Stripe,
        '{"id":"evt_new","type":"x","data":{}}',
        {},
      );

      expect(result.status).toBe(WebhookEventStatus.Received);
      expect(result.id).toBeDefined();
      expect(webhooks.save).toHaveBeenCalled();
    });

    it('should process inline (call processWebhookEvent) when no job queue is wired', async () => {
      const { service, webhooks } = build({ existingWebhook: null });
      const savedRecord = makeWebhookRecord({ id: 'wh-new', status: WebhookEventStatus.Received });
      // First findOne: duplicate check → null; second: processWebhookEvent load → savedRecord
      (webhooks.findOne as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(savedRecord);

      await service.ingestWebhook(
        PaymentProvider.Stripe,
        '{"id":"evt_new","type":"x","data":{}}',
        {},
      );

      // processWebhookEvent ran inline and saved the record (at minimum once for create + once for status update)
      expect(webhooks.save).toHaveBeenCalled();
    });
  });

  describe('processWebhookEvent', () => {
    it('should be a no-op when the record does not exist', async () => {
      const { service, webhooks } = build();
      (webhooks.findOne as jest.Mock).mockResolvedValue(null);

      await service.processWebhookEvent('nonexistent');

      expect(webhooks.save).not.toHaveBeenCalled();
    });

    it('should be a no-op when the record is already in Processed status (idempotency)', async () => {
      const { service, webhooks } = build();
      (webhooks.findOne as jest.Mock).mockResolvedValue(
        makeWebhookRecord({ status: WebhookEventStatus.Processed }),
      );

      await service.processWebhookEvent('wh-1');

      expect(webhooks.save).not.toHaveBeenCalled();
    });

    it('should mark the record as Processed after applying a subscription.updated event (no-op effect)', async () => {
      const { service, webhooks } = build();
      const record = makeWebhookRecord({ status: WebhookEventStatus.Received });
      (webhooks.findOne as jest.Mock).mockResolvedValue(record);

      await service.processWebhookEvent('wh-1');

      const savedRecord = (webhooks.save as jest.Mock).mock.calls[0]?.[0] as PaymentWebhookEvent;
      expect(savedRecord.status).toBe(WebhookEventStatus.Processed);
      expect(savedRecord.processedAt).not.toBeNull();
    });

    it('should mark the record as Failed when the effect handler throws', async () => {
      // Use subscription.renewed event so applyWebhookEffect calls renew(), which we make throw
      const renewedEvent = {
        ...makeProviderEvent('subscription.renewed'),
        amount: 499,
        currency: 'usd',
        periodEnd: null,
      };
      const { service, webhooks, subscriptionService } = build({
        adapterOverrides: {
          parseWebhookEvent: jest.fn().mockReturnValue(renewedEvent),
        },
      });
      const record = makeWebhookRecord({ status: WebhookEventStatus.Received });
      (webhooks.findOne as jest.Mock).mockResolvedValue(record);
      (subscriptionService.renew as jest.Mock).mockRejectedValue(
        new Error('subscription not found'),
      );

      await service.processWebhookEvent('wh-1');

      const savedRecord = (webhooks.save as jest.Mock).mock.calls[0]?.[0] as PaymentWebhookEvent;
      expect(savedRecord.status).toBe(WebhookEventStatus.Failed);
      expect(savedRecord.error).toContain('subscription not found');
    });

    it('should call subscriptionService.renew for a subscription.renewed event', async () => {
      const periodEnd = new Date(Date.now() + 30 * 86_400_000);
      const renewedEvent = {
        ...makeProviderEvent('subscription.renewed'),
        amount: 499,
        currency: 'usd',
        periodEnd,
      };
      const { service, webhooks, subscriptionService } = build({
        adapterOverrides: {
          parseWebhookEvent: jest.fn().mockReturnValue(renewedEvent),
        },
      });
      const record = makeWebhookRecord({ status: WebhookEventStatus.Received });
      (webhooks.findOne as jest.Mock).mockResolvedValue(record);

      await service.processWebhookEvent('wh-1');

      expect(subscriptionService.renew).toHaveBeenCalledWith('u1', periodEnd);
    });

    it('should call subscriptionService.enterGracePeriod for a payment.failed event', async () => {
      const failedEvent = {
        ...makeProviderEvent('payment.failed'),
        amount: 499,
        currency: 'usd',
      };
      const { service, webhooks, subscriptionService } = build({
        adapterOverrides: {
          parseWebhookEvent: jest.fn().mockReturnValue(failedEvent),
        },
      });
      const record = makeWebhookRecord({
        status: WebhookEventStatus.Received,
        type: 'invoice.payment_failed',
      });
      (webhooks.findOne as jest.Mock).mockResolvedValue(record);

      await service.processWebhookEvent('wh-1');

      expect(subscriptionService.enterGracePeriod).toHaveBeenCalledWith('u1');
    });
  });

  describe('refund', () => {
    it('should throw PaymentNotFoundException when the payment does not exist', async () => {
      const { service, payments } = build();
      (payments.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.refund('nonexistent', {
          id: 'admin-1',
          role: 'admin',
          ip: null,
          userAgent: null,
          requestId: null,
        }),
      ).rejects.toBeInstanceOf(PaymentNotFoundException);
    });

    it('should call the provider adapter refund and record a negative payment row', async () => {
      const { service, payments, adapter } = build({
        adapterOverrides: {
          refund: jest.fn().mockResolvedValue({
            providerRefundId: 'ref_abc',
            amount: 499,
            status: PaymentStatus.Refunded,
          }),
        },
      });
      (payments.findOne as jest.Mock).mockResolvedValue({
        id: 'pay-1',
        userId: 'u1',
        provider: PaymentProvider.Stripe,
        providerPaymentId: 'ch_abc',
        amount: 499,
        currency: 'usd',
        method: 'card',
        subscriptionId: 'sub-1',
        invoiceId: 'inv-1',
      });

      await service.refund(
        'pay-1',
        { id: 'admin-1', role: 'admin', ip: null, userAgent: null, requestId: null },
        499,
        'Customer request',
      );

      expect(adapter.refund).toHaveBeenCalledWith(
        expect.objectContaining({ providerPaymentId: 'ch_abc', amount: 499 }),
      );
      expect(payments.save).toHaveBeenCalledWith(
        expect.objectContaining({ amount: -499, status: PaymentStatus.Refunded }),
      );
    });
  });
});
