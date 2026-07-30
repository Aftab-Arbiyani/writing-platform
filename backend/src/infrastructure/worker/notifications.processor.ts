import { Processor } from '@nestjs/bullmq';

import { QUEUE } from '../../common/queue/queue.constants';
import { BaseProcessor } from './base.processor';
import { BroadcastHandler } from './handlers/notifications.handlers';
import { workerConcurrency } from '../queue/worker-concurrency';

/**
 * Notification worker (docs 02 §7) — handles the one unbounded notification
 * operation, system-broadcast fan-out ({@link BroadcastHandler}). Per-event,
 * bounded notifications stay on the synchronous `NotificationEventListener`.
 */
@Processor(QUEUE.Notifications, { concurrency: workerConcurrency(QUEUE.Notifications) })
export class NotificationsProcessor extends BaseProcessor {
  protected readonly queueName = QUEUE.Notifications;

  constructor(broadcast: BroadcastHandler) {
    super([broadcast]);
  }
}
