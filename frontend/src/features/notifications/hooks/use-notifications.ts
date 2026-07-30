import type { NotificationStatus, NotificationType } from '@qalam/shared';
import { useInfiniteQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth.store';

import { notificationsApi } from '../api/notifications.api';

/**
 * The infinite notification inbox (docs/12 §2.3) over the ADR §5 cursor contract. Live tier: 30s
 * `staleTime` + refetch-on-focus so the inbox is fresh when you return to the tab (docs/12 §2.2).
 * The `queryFn` signal cancels a stale request when the status/type filter changes (docs/32 §5).
 * Gated on auth — notifications are always recipient-scoped, so it never fires signed-out.
 */
export function useNotifications(status?: NotificationStatus, type?: NotificationType) {
  const isAuthed = useAuthStore((s) => s.status === 'authenticated');

  return useInfiniteQuery({
    queryKey: qk.notifications.list(status, type),
    queryFn: ({ pageParam, signal }) =>
      notificationsApi.list({ status, type, cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    enabled: isAuthed,
  });
}
