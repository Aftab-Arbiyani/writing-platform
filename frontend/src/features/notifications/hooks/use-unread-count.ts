import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth.store';

import { notificationsApi } from '../api/notifications.api';

/**
 * The unread badge count (`GET /notifications/unread-count`). There is NO WebSocket in `v1`
 * (E9 — in-app only, no real-time), so freshness comes from POLLING: a 45s `refetchInterval`
 * plus refetch-on-focus/reconnect. The count is SERVER state, so it lives here in TanStack Query
 * and the badge renders from it (hard-rule #4 — never mirrored into Zustand). Redis-cached
 * server-side, so polling is cheap. Gated on auth.
 */
export const UNREAD_POLL_MS = 45_000;

export function useUnreadCount(enabled = true) {
  const isAuthed = useAuthStore((s) => s.status === 'authenticated');

  return useQuery({
    queryKey: qk.notifications.unreadCount(),
    queryFn: ({ signal }) => notificationsApi.unreadCount(signal),
    enabled: enabled && isAuthed,
    staleTime: 20_000,
    refetchInterval: UNREAD_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}
