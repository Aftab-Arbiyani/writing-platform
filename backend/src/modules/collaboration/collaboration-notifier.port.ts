import type { NotificationEntityType, NotificationType } from '@qalam/shared';

/**
 * Outbound notification port for collaboration (AF6). Decouples this module from
 * the notifications engine the same way `JOB_ENQUEUER` decouples pieces from
 * BullMQ: services depend on this narrow interface (injected `@Optional()`), and
 * the module binds a thin adapter over `NotificationsService` at runtime. Keeping
 * the concrete engine out of the services' import graph also keeps their unit
 * tests light — they mock this port, not the whole notifications stack.
 *
 * All collaboration notifications are best-effort: a delivery failure never fails
 * the originating write (see each service's `safeNotify`).
 */
export interface CollaborationNotification {
  recipientId: string;
  actorId?: string | null;
  type: NotificationType;
  entityType?: NotificationEntityType | null;
  entityId?: string | null;
  data?: Record<string, unknown>;
}

export interface CollaborationNotifier {
  notify(input: CollaborationNotification): Promise<void>;
}

/** DI token for {@link CollaborationNotifier} (bound in `CollaborationModule`). */
export const COLLABORATION_NOTIFIER = Symbol('COLLABORATION_NOTIFIER');
