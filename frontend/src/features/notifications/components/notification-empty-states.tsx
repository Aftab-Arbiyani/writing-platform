import { QEmptyState } from '@qalam/ui';
import { Archive, BellOff, CheckCheck, Inbox, WifiOff } from 'lucide-react';
import type { ReactElement } from 'react';

import { useAppStore } from '@/stores/app.store';

import type { InboxStatus } from '../hooks/use-notification-params';

/**
 * Inbox empty states (docs/06 §4.4 catalogue) — literary voice, never blaming the reader. The copy
 * matches the active filter: "All quiet" for the whole inbox, "all caught up" for unread, etc. When
 * the device is offline we say so instead of showing a false-empty inbox.
 */
export function NotificationsEmpty({
  status,
  hasTypeFilter,
}: {
  status: InboxStatus;
  hasTypeFilter: boolean;
}): ReactElement {
  const isOnline = useAppStore((s) => s.isOnline);

  if (!isOnline) {
    return (
      <QEmptyState
        icon={WifiOff}
        title="You're offline."
        description="We'll show your notifications the moment you're reconnected."
      />
    );
  }

  if (hasTypeFilter) {
    return (
      <QEmptyState
        icon={Inbox}
        title="Nothing of that kind yet."
        description="Try a different filter, or check back later."
      />
    );
  }

  switch (status) {
    case 'unread':
      return (
        <QEmptyState
          icon={CheckCheck}
          title="You're all caught up."
          description="No unread notifications — every response has been seen."
        />
      );
    case 'read':
      return (
        <QEmptyState
          icon={Inbox}
          title="Nothing read yet."
          description="Read notifications land here."
        />
      );
    case 'archived':
      return (
        <QEmptyState
          icon={Archive}
          title="No archived notifications."
          description="Notifications you archive are kept here."
        />
      );
    default:
      return (
        <QEmptyState
          icon={BellOff}
          title="All quiet."
          description="When readers respond to your words, you'll hear it here."
        />
      );
  }
}
