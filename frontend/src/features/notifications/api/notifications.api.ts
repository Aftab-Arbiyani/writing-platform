import type { NotificationStatus, NotificationType } from '@qalam/shared';

import { del, get, getPage, patch, type CursorPage } from '@/lib/api-client';
import { buildQueryString } from '@/lib/http';

import type {
  NotificationItem,
  NotificationPreferences,
  UnreadCount,
} from '../types/notification.types';

/**
 * The notifications `api/` layer — the only place the E9 endpoints are named (docs/32 §10). Every
 * operation is recipient-scoped server-side (the JWT); a foreign id reads as 404. Query strings
 * are built here; the mutation endpoints return 204 (→ `void`). The list threads an `AbortSignal`
 * so a stale filter change is cancelled by TanStack Query (docs/32 §5).
 */

interface ListArgs {
  status?: NotificationStatus;
  type?: NotificationType;
  cursor?: string;
  limit?: number;
  signal?: AbortSignal;
}

export const notificationsApi = {
  /** GET /notifications — the recipient's inbox, newest first, cursor-paginated. */
  list: ({
    status,
    type,
    cursor,
    limit = 20,
    signal,
  }: ListArgs): Promise<CursorPage<NotificationItem>> => {
    const query = buildQueryString({ status, type, cursor, limit });
    return getPage<NotificationItem>(`/notifications${query}`, { signal });
  },

  /** GET /notifications/unread-count — { count, capped } (Redis-cached, 99+ cap). */
  unreadCount: (signal?: AbortSignal): Promise<UnreadCount> =>
    get<UnreadCount>('/notifications/unread-count', { signal }),

  /** PATCH /notifications/:id/read — mark one read (204). */
  markRead: (id: string): Promise<void> => patch(`/notifications/${encodeURIComponent(id)}/read`),

  /** PATCH /notifications/read-all — mark every unread notification read (204). */
  markAllRead: (): Promise<void> => patch('/notifications/read-all'),

  /** PATCH /notifications/:id/archive — archive one (204). */
  archive: (id: string): Promise<void> => patch(`/notifications/${encodeURIComponent(id)}/archive`),

  /** DELETE /notifications/:id — soft-delete one (204). */
  remove: (id: string): Promise<void> => del(`/notifications/${encodeURIComponent(id)}`),

  /** GET /notification-preferences — the seven category toggles (defaults all on). */
  getPreferences: (signal?: AbortSignal): Promise<NotificationPreferences> =>
    get<NotificationPreferences>('/notification-preferences', { signal }),

  /** PATCH /notification-preferences — partial update; returns the resolved set. */
  updatePreferences: (
    patchBody: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> =>
    patch<NotificationPreferences>('/notification-preferences', patchBody),
};
