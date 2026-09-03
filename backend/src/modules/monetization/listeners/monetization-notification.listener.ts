import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { NotificationEntityType, NotificationType, SubscriptionEventType } from '@qalam/shared';

import { DomainEventBus } from '../../../common/events/domain-event-bus';
import {
  DomainEventType,
  type AiQuotaExceededEvent,
  type PaymentFailedEvent,
  type PaymentSucceededEvent,
  type SubscriptionChangedEvent,
  type SubscriptionTrialEndingEvent,
} from '../../../common/events/domain-events';
import { NotificationsService } from '../../notifications/notifications.service';

/**
 * The monetization notification + observability seam (AF5). Translates decoupled
 * monetization domain events into `NotificationsService.create()` calls (the only place
 * these events become notifications — the billing/subscription services stay ignorant of
 * notifications, they just emit), and logs each event structurally for metrics/telemetry
 * (subscription/payment/webhook/usage/credit events, conversion signals). Every handler is
 * best-effort — the bus isolates thrown errors so a notification failure never affects the
 * billing action that emitted the event.
 */
@Injectable()
export class MonetizationNotificationListener implements OnModuleInit {
  private readonly logger = new Logger(MonetizationNotificationListener.name);

  constructor(
    private readonly bus: DomainEventBus,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.bus.on(DomainEventType.SubscriptionChanged, (e) => this.onSubscriptionChanged(e));
    this.bus.on(DomainEventType.SubscriptionTrialEnding, (e) => this.onTrialEnding(e));
    this.bus.on(DomainEventType.PaymentSucceeded, (e) => this.onPaymentSucceeded(e));
    this.bus.on(DomainEventType.PaymentFailed, (e) => this.onPaymentFailed(e));
    this.bus.on(DomainEventType.AiQuotaExceeded, (e) => this.onQuotaExceeded(e));
  }

  private async onSubscriptionChanged(e: SubscriptionChangedEvent): Promise<void> {
    this.logger.log(
      `subscription.${e.eventType} user=${e.userId} tier=${e.tier} status=${e.status}`,
    );
    const type =
      e.eventType === SubscriptionEventType.Renewed
        ? NotificationType.SubscriptionRenewed
        : e.eventType === SubscriptionEventType.Expired
          ? NotificationType.SubscriptionExpired
          : null;
    if (type === null) {
      return; // most transitions are silent; only renewal + expiry notify
    }
    await this.notifications.create({
      recipientId: e.userId,
      type,
      entityType: NotificationEntityType.Subscription,
      entityId: e.subscriptionId,
      data: { tier: e.tier, status: e.status },
    });
  }

  private async onTrialEnding(e: SubscriptionTrialEndingEvent): Promise<void> {
    this.logger.log(`subscription.trial_ending user=${e.userId} ends=${e.trialEnd}`);
    await this.notifications.create({
      recipientId: e.userId,
      type: NotificationType.TrialEnding,
      entityType: NotificationEntityType.Subscription,
      entityId: e.subscriptionId,
      data: { trialEnd: e.trialEnd },
      dedupe: true,
    });
  }

  private async onPaymentSucceeded(e: PaymentSucceededEvent): Promise<void> {
    this.logger.log(`payment.succeeded user=${e.userId} amount=${e.amount} ${e.currency}`);
    await this.notifications.create({
      recipientId: e.userId,
      type: NotificationType.PaymentReceipt,
      entityType: NotificationEntityType.Invoice,
      entityId: e.invoiceId,
      data: { amount: e.amount, currency: e.currency },
    });
  }

  private async onPaymentFailed(e: PaymentFailedEvent): Promise<void> {
    this.logger.warn(`payment.failed user=${e.userId} amount=${e.amount} reason=${e.reason}`);
    await this.notifications.create({
      recipientId: e.userId,
      type: NotificationType.PaymentFailed,
      entityType: NotificationEntityType.System,
      data: { amount: e.amount, currency: e.currency, reason: e.reason },
    });
  }

  private async onQuotaExceeded(e: AiQuotaExceededEvent): Promise<void> {
    this.logger.log(`ai.quota_exceeded user=${e.userId} window=${e.window}`);
    await this.notifications.create({
      recipientId: e.userId,
      type: NotificationType.QuotaExceeded,
      entityType: NotificationEntityType.System,
      data: { window: e.window, feature: e.feature },
      dedupe: true,
    });
  }
}
