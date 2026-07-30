import { Injectable } from '@nestjs/common';

import { NotificationsService } from '../notifications';
import type {
  CollaborationNotification,
  CollaborationNotifier,
} from './collaboration-notifier.port';

/**
 * Binds the collaboration notifier port to the platform's `NotificationsService`
 * (AF6). Lives apart from the services so the notifications engine is required
 * only where the module is assembled — never in a service's (or its unit test's)
 * import graph. `NotificationsService.create` already drops self-notifications and
 * honors recipient preferences, so this is a straight pass-through.
 */
@Injectable()
export class NotificationsCollaborationNotifier implements CollaborationNotifier {
  constructor(private readonly notifications: NotificationsService) {}

  notify(input: CollaborationNotification): Promise<void> {
    return this.notifications.create(input);
  }
}
