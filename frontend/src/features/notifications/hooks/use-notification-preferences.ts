import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth.store';

import { notificationsApi } from '../api/notifications.api';
import type { NotificationPreferences } from '../types/notification.types';

/**
 * Notification category preferences (`GET/PATCH /notification-preferences`). Content tier (5m
 * staleTime — rarely changes). The update is optimistic (docs/12 §2.5) so a toggle flips instantly;
 * the PATCH returns the authoritative resolved set, which replaces the cache on success.
 */
export function useNotificationPreferences() {
  const isAuthed = useAuthStore((s) => s.status === 'authenticated');
  return useQuery({
    queryKey: qk.notifications.preferences(),
    queryFn: ({ signal }) => notificationsApi.getPreferences(signal),
    enabled: isAuthed,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateNotificationPreferences() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<NotificationPreferences>) =>
      notificationsApi.updatePreferences(patch),
    onMutate: async (patch) => {
      await client.cancelQueries({ queryKey: qk.notifications.preferences() });
      const previous = client.getQueryData<NotificationPreferences>(qk.notifications.preferences());
      if (previous) {
        client.setQueryData<NotificationPreferences>(qk.notifications.preferences(), {
          ...previous,
          ...patch,
        });
      }
      return { previous };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.previous) client.setQueryData(qk.notifications.preferences(), ctx.previous);
    },
    onSuccess: (data) => {
      client.setQueryData(qk.notifications.preferences(), data);
    },
  });
}
