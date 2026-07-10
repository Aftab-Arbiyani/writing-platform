import { NotificationStatus } from '@qalam/shared';
import {
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';

import type { CursorPage } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';

import { notificationsApi } from '../api/notifications.api';
import type { NotificationItem, UnreadCount } from '../types/notification.types';

/**
 * Inbox mutations with optimistic updates (docs/12 §2.5, prompt: "optimistic read/unread"): mark
 * one read, mark all read, archive, delete. Each patches EVERY cached inbox variant (all
 * status/type filters, via the `lists()` prefix) plus the unread-count badge, then reconciles on
 * settle. `v1` has no "mark unread" endpoint, so that action is intentionally absent (never faked).
 *
 * The `?status=archived` inbox is excluded from optimistic mutation of `read/all` so an archived
 * list is not disturbed; archive/delete remove the row from the active inbox everywhere.
 */

type ListData = InfiniteData<CursorPage<NotificationItem>, string | undefined>;

/** Apply `fn` to every item across every cached inbox page; drop items `fn` maps to null. */
function mapItems(
  client: QueryClient,
  fn: (item: NotificationItem) => NotificationItem | null,
): void {
  client.setQueriesData<ListData>({ queryKey: qk.notifications.lists() }, (old) => {
    if (!old) return old;
    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        items: page.items.map(fn).filter((item): item is NotificationItem => item !== null),
      })),
    };
  });
}

/** Nudge the unread badge by `delta` (never below 0); `set0` zeroes it (mark-all-read). */
function bumpUnread(client: QueryClient, delta: number, set0 = false): void {
  client.setQueryData<UnreadCount>(qk.notifications.unreadCount(), (old) => {
    if (!old) return old;
    const count = set0 ? 0 : Math.max(0, old.count + delta);
    return { count, capped: count > 99 };
  });
}

/** Snapshot every list + the unread count so onError can restore them. */
function snapshot(client: QueryClient): [readonly unknown[], unknown][] {
  return [
    ...client.getQueriesData({ queryKey: qk.notifications.lists() }),
    [qk.notifications.unreadCount(), client.getQueryData(qk.notifications.unreadCount())],
  ];
}
function restore(client: QueryClient, entries: [readonly unknown[], unknown][]): void {
  for (const [key, data] of entries) client.setQueryData(key, data);
}

function isUnread(item: NotificationItem): boolean {
  return item.status === NotificationStatus.Unread;
}

export function useNotificationMutations() {
  const client = useQueryClient();

  const settle = (): void => {
    void client.invalidateQueries({ queryKey: qk.notifications.all });
  };

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: qk.notifications.all });
      const previous = snapshot(client);
      let wasUnread = false;
      mapItems(client, (item) => {
        if (item.id !== id) return item;
        if (isUnread(item)) wasUnread = true;
        return { ...item, status: NotificationStatus.Read, readAt: new Date().toISOString() };
      });
      if (wasUnread) bumpUnread(client, -1);
      return { previous };
    },
    onError: (_e, _id, ctx) => {
      if (ctx) restore(client, ctx.previous);
    },
    onSettled: settle,
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onMutate: async () => {
      await client.cancelQueries({ queryKey: qk.notifications.all });
      const previous = snapshot(client);
      const now = new Date().toISOString();
      mapItems(client, (item) =>
        isUnread(item) ? { ...item, status: NotificationStatus.Read, readAt: now } : item,
      );
      bumpUnread(client, 0, true);
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) restore(client, ctx.previous);
    },
    onSettled: settle,
  });

  const archive = useMutation({
    mutationFn: (id: string) => notificationsApi.archive(id),
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: qk.notifications.all });
      const previous = snapshot(client);
      let wasUnread = false;
      mapItems(client, (item) => {
        if (item.id !== id) return item;
        if (isUnread(item)) wasUnread = true;
        return null; // archived rows leave the active inbox
      });
      if (wasUnread) bumpUnread(client, -1);
      return { previous };
    },
    onError: (_e, _id, ctx) => {
      if (ctx) restore(client, ctx.previous);
    },
    onSettled: settle,
  });

  const remove = useMutation({
    mutationFn: (id: string) => notificationsApi.remove(id),
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: qk.notifications.all });
      const previous = snapshot(client);
      let wasUnread = false;
      mapItems(client, (item) => {
        if (item.id !== id) return item;
        if (isUnread(item)) wasUnread = true;
        return null;
      });
      if (wasUnread) bumpUnread(client, -1);
      return { previous };
    },
    onError: (_e, _id, ctx) => {
      if (ctx) restore(client, ctx.previous);
    },
    onSettled: settle,
  });

  return { markRead, markAllRead, archive, remove };
}
