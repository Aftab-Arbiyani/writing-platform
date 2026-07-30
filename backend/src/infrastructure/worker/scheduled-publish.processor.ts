import { Processor } from '@nestjs/bullmq';

import { QUEUE } from '../../common/queue/queue.constants';
import { BaseProcessor } from './base.processor';
import { PublishDueHandler, PublishOneHandler } from './handlers/scheduled-publish.handlers';
import { workerConcurrency } from '../queue/worker-concurrency';

/**
 * Publishing worker (docs 02 §6.2) — the per-queue WorkerHost. It only wires the
 * queue's typed job handlers; all logic lives in {@link PublishDueHandler}
 * (the every-minute reconciliation sweep) and {@link PublishOneHandler} (the
 * delayed per-piece job). Dispatch, validation, logging, and retry are handled
 * by {@link BaseProcessor}.
 */
@Processor(QUEUE.ScheduledPublish, { concurrency: workerConcurrency(QUEUE.ScheduledPublish) })
export class ScheduledPublishProcessor extends BaseProcessor {
  protected readonly queueName = QUEUE.ScheduledPublish;

  constructor(publishDue: PublishDueHandler, publishOne: PublishOneHandler) {
    super([publishDue, publishOne]);
  }
}
