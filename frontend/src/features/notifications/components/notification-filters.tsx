import { NotificationStatus, NotificationType } from '@qalam/shared';
import { QSelect, cn } from '@qalam/ui';
import type { ReactElement } from 'react';

import type {
  InboxStatus,
  InboxType,
  UseNotificationParamsResult,
} from '../hooks/use-notification-params';

/** Primary status views (map 1:1 to `?status=`). */
const STATUS_TABS: readonly { value: InboxStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: NotificationStatus.Unread, label: 'Unread' },
  { value: NotificationStatus.Read, label: 'Read' },
  { value: NotificationStatus.Archived, label: 'Archived' },
];

/**
 * Type filter options (map 1:1 to `?type=`). Only the types the backend actually emits are
 * offered (repost/featured/collection_follow are reserved and never occur, so they're omitted to
 * keep the menu honest — the URL still accepts them).
 */
const TYPE_OPTIONS: readonly { value: InboxType; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: NotificationType.Mention, label: 'Mentions' },
  { value: NotificationType.Comment, label: 'Comments' },
  { value: NotificationType.CommentReply, label: 'Replies' },
  { value: NotificationType.Follow, label: 'New followers' },
  { value: NotificationType.FollowRequest, label: 'Follow requests' },
  { value: NotificationType.Clap, label: 'Claps' },
  { value: NotificationType.Like, label: 'Likes' },
  { value: NotificationType.Response, label: 'Responses' },
  { value: NotificationType.System, label: 'Announcements' },
];

/**
 * Inbox filters (docs/06 §3.9, the prompt's filter set) — a URL-driven status segmented control
 * (All / Unread / Read / Archived) plus a type select. Both are shareable (they live in the URL)
 * and map straight to the `GET /notifications` params. Horizontally scrollable on mobile.
 */
export function NotificationFilters({
  params,
}: {
  params: UseNotificationParamsResult;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Filter by status" className="flex gap-1 overflow-x-auto">
        {STATUS_TABS.map(({ value, label }) => {
          const active = params.status === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => {
                params.setStatus(value);
              }}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-accent/12 text-accent'
                  : 'text-ink-secondary hover:bg-raised hover:text-ink',
              )}
            >
              {label}
            </button>
          );
        })}
      </nav>

      <QSelect
        aria-label="Filter by type"
        style={{ minWidth: 168 }}
        value={params.type}
        onChange={(value) => {
          if (typeof value === 'string') params.setType(value as InboxType);
        }}
        options={TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
      />
    </div>
  );
}
