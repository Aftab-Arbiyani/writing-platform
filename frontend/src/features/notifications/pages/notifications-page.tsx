import { QButton } from '@qalam/ui';
import { CheckCheck, Settings } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router';

import { usePageTitle } from '@/hooks/use-page-title';
import { ROUTES } from '@/lib/routes';

import { NotificationFilters } from '../components/notification-filters';
import { NotificationList } from '../components/notification-list';
import { useNotificationMutations } from '../hooks/use-notification-mutations';
import { useNotificationParams } from '../hooks/use-notification-params';
import { useNotifications } from '../hooks/use-notifications';
import { useUnreadCount } from '../hooks/use-unread-count';
import type { NotificationItem } from '../types/notification.types';

/**
 * The full Activity Center (`/notifications`, docs/06 §3.9, docs/11 §10). URL-driven status + type
 * filters; the inbox is a cursor-paginated infinite query grouped by date. Header carries an
 * explicit "Mark all read" (disabled when nothing is unread) and a link to notification settings.
 * Every action is optimistic. Auth-gated by the route.
 */
export function NotificationsPage(): ReactElement {
  usePageTitle('Notifications');
  const params = useNotificationParams();
  const query = useNotifications(params.statusParam, params.typeParam);
  const unread = useUnreadCount();
  const { markRead, markAllRead, archive, remove } = useNotificationMutations();

  const hasUnread = (unread.data?.count ?? 0) > 0;

  const onOpen = (n: NotificationItem): void => {
    if (n.status === 'unread') markRead.mutate(n.id);
  };

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-semibold text-ink">Notifications</h1>
        <div className="flex items-center gap-1">
          <QButton
            variant="ghost"
            size="sm"
            icon={CheckCheck}
            disabled={!hasUnread || markAllRead.isPending}
            onClick={() => {
              markAllRead.mutate();
            }}
          >
            Mark all read
          </QButton>
          <Link
            to={ROUTES.settingsNotifications}
            aria-label="Notification settings"
            className="inline-flex size-9 items-center justify-center rounded-md text-ink-muted hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Settings size={18} strokeWidth={1.75} aria-hidden />
          </Link>
        </div>
      </header>

      <NotificationFilters params={params} />

      <NotificationList
        query={query}
        status={params.status}
        hasTypeFilter={params.type !== 'all'}
        onOpen={onOpen}
        onMarkRead={(id) => markRead.mutate(id)}
        onArchive={(id) => archive.mutate(id)}
        onDelete={(id) => remove.mutate(id)}
      />
    </div>
  );
}
