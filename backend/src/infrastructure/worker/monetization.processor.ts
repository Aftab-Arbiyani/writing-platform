import { Processor } from '@nestjs/bullmq';

import { QUEUE } from '../../common/queue/queue.constants';
import { BaseProcessor } from './base.processor';
import {
  MonetizationLifecycleSweepHandler,
  MonetizationWebhookHandler,
} from './handlers/monetization.handlers';
import { workerConcurrency } from '../queue/worker-concurrency';

/**
 * Monetization worker (AF5) — async provider-webhook processing + the subscription
 * lifecycle sweep. Webhook ingestion persists + enqueues fast; this worker applies the
 * effect off the request path (idempotent, retriable).
 */
@Processor(QUEUE.Monetization, { concurrency: workerConcurrency(QUEUE.Monetization) })
export class MonetizationProcessor extends BaseProcessor {
  protected readonly queueName = QUEUE.Monetization;

  constructor(
    webhook: MonetizationWebhookHandler,
    lifecycleSweep: MonetizationLifecycleSweepHandler,
  ) {
    super([webhook, lifecycleSweep]);
  }
}
