import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { JOB } from '../../../common/queue/queue.constants';
import { BillingService } from '../../../modules/monetization/billing.service';
import { SubscriptionService } from '../../../modules/monetization/subscription.service';
import { AbstractJobHandler } from '../abstract-job-handler';

const webhookPayload = z.object({ webhookEventId: z.string().min(1) });

/**
 * Async webhook processing (AF5) — applies one persisted provider webhook event
 * (idempotent; the effect is a no-op if already processed). Retriable: a transient
 * failure re-runs on BullMQ backoff.
 */
@Injectable()
export class MonetizationWebhookHandler extends AbstractJobHandler<typeof JOB.MonetizationWebhook> {
  readonly job = JOB.MonetizationWebhook;

  constructor(private readonly billing: BillingService) {
    super();
  }

  validate(raw: unknown): { webhookEventId: string } {
    return webhookPayload.parse(raw);
  }

  async handle(data: { webhookEventId: string }): Promise<{ webhookEventId: string }> {
    await this.billing.processWebhookEvent(data.webhookEventId);
    return { webhookEventId: data.webhookEventId };
  }
}

/**
 * Subscription lifecycle sweep (AF5) — expires elapsed grace windows + lapsed trials and
 * nudges trials ending soon. Idempotent; scheduled by the cron/scheduler seam.
 */
@Injectable()
export class MonetizationLifecycleSweepHandler extends AbstractJobHandler<
  typeof JOB.MonetizationLifecycleSweep
> {
  readonly job = JOB.MonetizationLifecycleSweep;

  constructor(private readonly subscriptions: SubscriptionService) {
    super();
  }

  validate(): Record<string, never> {
    return {};
  }

  async handle(): Promise<{ expired: number; nudged: number }> {
    return this.subscriptions.runLifecycleSweep();
  }
}
