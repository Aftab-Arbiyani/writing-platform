import { QButton, QSpinner } from '@qalam/ui';
import { CheckCheck } from 'lucide-react';
import { type ReactElement } from 'react';
import { Link } from 'react-router';

import { getErrorMessage } from '@/lib/errors';
import { ROUTES } from '@/lib/routes';

import { useNotificationMutations } from '../hooks/use-notification-mutations';
import { useNotifications } from '../hooks/use-notifications';
import type { NotificationItem } from '../types/notification.types';
import { NotificationsEmpty } from './notification-empty-states';
import { NotificationRow } from './notification-item';
import { NotificationListSkeleton } from './notification-skeleton';

/**
 * The desktop bell popover (docs/06 §3.9) — a 400px panel showing the recent inbox (first page,
 * flat — the full page owns date grouping + pagination). Header carries an explicit "Mark all
 * read"; the footer links to the full `/notifications` page. Opening does NOT auto-mark items read
 * (see the epic notes — no batch endpoint, and it's surprising); a click marks that row read.
 * `role="dialog"` + a labelled region for screen readers.
 */
export function NotificationPopover({ onClose }: { onClose: () => void }): ReactElement {
  const query = useNotifications();
  const { markRead, markAllRead, archive, remove } = useNotificationMutations();
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  const handleOpen = (n: NotificationItem): void => {
    if (n.status === 'unread') markRead.mutate(n.id);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-label="Notifications"
      className="border-line absolute end-0 top-full z-[1030] mt-2 flex max-h-[560px] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border bg-surface shadow-[var(--q-shadow-3)]"
    >
      {/* Plain div, not <header>: a banner landmark inside a role=dialog duplicates the app banner. */}
      <div className="border-line flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">Notifications</h2>
        <QButton
          variant="ghost"
          size="sm"
          icon={CheckCheck}
          onClick={() => {
            markAllRead.mutate();
          }}
        >
          Mark all read
        </QButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {query.isLoading ? (
          <NotificationListSkeleton count={5} />
        ) : query.isError ? (
          <div className="px-4 py-8 text-center text-sm text-ink-muted">
            {getErrorMessage(query.error)}
            <div className="mt-3">
              <QButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  void query.refetch();
                }}
              >
                Try again
              </QButton>
            </div>
          </div>
        ) : items.length === 0 ? (
          <NotificationsEmpty status="all" hasTypeFilter={false} />
        ) : (
          <ul className="flex flex-col">
            {items.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onOpen={handleOpen}
                onMarkRead={(id) => markRead.mutate(id)}
                onArchive={(id) => archive.mutate(id)}
                onDelete={(id) => remove.mutate(id)}
              />
            ))}
            {query.isFetching && !query.isLoading ? (
              <li className="flex justify-center py-2" aria-hidden>
                <QSpinner size="small" />
              </li>
            ) : null}
          </ul>
        )}
      </div>

      {/* Plain div, not <footer>: a contentinfo landmark inside a role=dialog duplicates the app footer. */}
      <div className="border-line border-t px-2 py-2">
        <Link
          to={ROUTES.notifications}
          onClick={onClose}
          className="block rounded-md px-3 py-2 text-center text-sm font-medium text-accent hover:bg-raised"
        >
          See all notifications
        </Link>
      </div>
    </div>
  );
}
