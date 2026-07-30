import { QBadge } from '@qalam/ui';
import type { ReactElement, ReactNode } from 'react';

import { useUnreadCount } from '../hooks/use-unread-count';

/**
 * Wraps the mobile tab-bar "Alerts" icon with the unread count badge (docs/06 §3.9 — mobile shows
 * a count, capped "9+"). The count is the polled server value; `useUnreadCount` is auth-gated, so
 * for signed-out visitors it never fires and no badge shows. Safe to mount unconditionally.
 */
export function NotificationTabBadge({ children }: { children: ReactNode }): ReactElement {
  const unread = useUnreadCount();
  const count = unread.data?.count ?? 0;

  return (
    <QBadge
      count={count}
      max={9}
      srLabel={count > 0 ? `${String(count)} unread` : 'no unread notifications'}
    >
      {children}
    </QBadge>
  );
}
