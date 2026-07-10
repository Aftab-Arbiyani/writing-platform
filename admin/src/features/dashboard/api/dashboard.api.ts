import { api } from '@/lib/api-client';

import type { PlatformStats, QueueStatus, SystemNotification } from '../types/dashboard.types';

/**
 * The dashboard's `api/` layer — the only place its endpoints are named (docs/32 §10). All go through
 * the shared api-client (Bearer + envelope-unwrap + interceptors). These are the REAL endpoints that
 * exist; needs with no backend endpoint (activity feed, moderation summary, verified/report counts,
 * media storage) have NO api call and render an honest "unavailable" state in their widget.
 */
export const dashboardApi = {
  /** GET /analytics/platform — platform-wide counts (requires `analytics.view`). */
  platformStats: (signal?: AbortSignal): Promise<PlatformStats> =>
    api.get<PlatformStats>('/analytics/platform', { signal }).then((result) => result.data),

  /** GET /admin/queues — BullMQ queue + worker status (requires `admin.dashboard`). */
  queues: (signal?: AbortSignal): Promise<QueueStatus[]> =>
    api.get<QueueStatus[]>('/admin/queues', { signal }).then((result) => result.data),

  /** GET /admin/system-notifications — admin-authored broadcasts (requires `notification.manage`). */
  systemNotifications: (limit: number, signal?: AbortSignal): Promise<SystemNotification[]> =>
    api
      .get<SystemNotification[]>('/admin/system-notifications', { query: { limit }, signal })
      .then((result) => result.data),
};
