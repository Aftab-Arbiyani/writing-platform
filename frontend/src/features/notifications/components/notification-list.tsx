import { QErrorState, QSpinner } from '@qalam/ui';
import type { ReactElement } from 'react';

import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { getErrorMessage, getRequestId } from '@/lib/errors';

import type { InboxStatus } from '../hooks/use-notification-params';
import type { useNotifications } from '../hooks/use-notifications';
import { groupByDate } from '../lib/group-by-date';
import type { NotificationItem } from '../types/notification.types';
import { NotificationsEmpty } from './notification-empty-states';
import { NotificationRow } from './notification-item';
import { NotificationListSkeleton } from './notification-skeleton';

interface NotificationListProps {
  query: ReturnType<typeof useNotifications>;
  status: InboxStatus;
  hasTypeFilter: boolean;
  onOpen: (n: NotificationItem) => void;
  onMarkRead: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * The full-page inbox list — owns the four feedback states (docs/06 §10.1): loading (skeleton),
 * error (in-place retry panel + requestId), empty (filter-aware literary copy), success (rows
 * grouped by date, docs/06 §3.9). Infinite scroll via the shared sentinel; a spinner while the
 * next page loads and a quiet end-cap when the inbox is exhausted.
 */
export function NotificationList({
  query,
  status,
  hasTypeFilter,
  onOpen,
  onMarkRead,
  onArchive,
  onDelete,
}: NotificationListProps): ReactElement {
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  const sentinelRef = useInfiniteScroll({
    hasMore: query.hasNextPage ?? false,
    isLoading: query.isFetchingNextPage,
    onLoadMore: () => {
      void query.fetchNextPage();
    },
  });

  if (query.isLoading) return <NotificationListSkeleton />;

  if (query.isError) {
    return (
      <QErrorState
        title="Couldn't load your notifications."
        description={getErrorMessage(query.error)}
        requestId={getRequestId(query.error)}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }

  if (items.length === 0) {
    return <NotificationsEmpty status={status} hasTypeFilter={hasTypeFilter} />;
  }

  const groups = groupByDate(items);

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`notif-group-${group.key}`}>
          {/* Sticky "Today ──────" divider — pins under the top bar as you scroll the timeline. */}
          <h2
            id={`notif-group-${group.key}`}
            className="sticky top-14 z-10 mb-1 flex items-center gap-3 bg-canvas/95 px-3 py-2 text-sm font-semibold text-ink backdrop-blur sm:top-16"
          >
            <span>{group.label}</span>
            <span aria-hidden className="h-px flex-1 bg-line" />
          </h2>
          <ul className="flex flex-col">
            {group.items.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onOpen={onOpen}
                onMarkRead={onMarkRead}
                onArchive={onArchive}
                onDelete={onDelete}
              />
            ))}
          </ul>
        </section>
      ))}

      <div ref={sentinelRef} aria-hidden className="h-px" />

      {query.isFetchingNextPage ? (
        <div
          role="status"
          aria-label="Loading more notifications"
          className="flex justify-center py-4"
        >
          <QSpinner />
        </div>
      ) : null}

      {!query.hasNextPage ? (
        <p className="py-6 text-center text-sm text-ink-muted">You&apos;ve reached the end.</p>
      ) : null}
    </div>
  );
}
