import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { JOB } from '../../../common/queue/queue.constants';
import { NotificationsService } from '../../../modules/notifications/notifications.service';
import { AbstractJobHandler } from '../abstract-job-handler';

const broadcastPayload = z.object({ recordId: z.string().min(1) });

/**
 * System-broadcast fan-out (docs 02 §5.2, unbounded). Reuses
 * `NotificationsService.fanOutSystemNotification`; the worker just drives it off
 * the queue so a large broadcast never blocks the admin request.
 */
@Injectable()
export class BroadcastHandler extends AbstractJobHandler<typeof JOB.Broadcast> {
  readonly job = JOB.Broadcast;

  constructor(private readonly notifications: NotificationsService) {
    super();
  }

  validate(raw: unknown): { recordId: string } {
    return broadcastPayload.parse(raw);
  }

  async handle(data: { recordId: string }): Promise<{ recordId: string; delivered: number }> {
    return {
      recordId: data.recordId,
      delivered: await this.notifications.fanOutSystemNotification(data.recordId),
    };
  }
}
