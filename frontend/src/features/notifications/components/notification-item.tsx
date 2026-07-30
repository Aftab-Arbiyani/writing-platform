import { NotificationStatus } from '@qalam/shared';
import { QAvatar, cn } from '@qalam/ui';
import { Archive, Check, Trash2 } from 'lucide-react';
import { memo, type ReactElement } from 'react';
import { Link } from 'react-router';

import { formatRelativeTime } from '@/lib/format';
import { mediaUrl } from '@/lib/media';

import { describeNotification, type NotificationTone } from '../lib/describe-notification';
import type { NotificationItem as Item } from '../types/notification.types';

/**
 * Semantic tone → token classes for the activity glyph's tinted circle + icon colour.
 *
 * Same fill/label pairing rule as QTag: a `-on-tint` label, never the fill token
 * (docs/48 §3.5). The glyph is an icon, so it answers to the 3:1 non-text bar rather
 * than 4.5 and was not failing — but leaving the wrong pairing in place is how the
 * class spread in the first place.
 */
const TONE: Record<NotificationTone, { circle: string; glyph: string }> = {
  accent: { circle: 'bg-accent/12', glyph: 'text-accent-on-tint' },
  success: { circle: 'bg-success/12', glyph: 'text-success-on-tint' },
  danger: { circle: 'bg-danger/12', glyph: 'text-danger-on-tint' },
  info: { circle: 'bg-info/12', glyph: 'text-info-on-tint' },
  warning: { circle: 'bg-warning/12', glyph: 'text-warning-on-tint' },
  neutral: { circle: 'bg-raised', glyph: 'text-ink-muted' },
};

/** A small ghost icon-button used for the per-row actions; sits above the stretched row link. */
function RowAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Check;
  label: string;
  onClick: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="relative z-10 inline-flex size-8 items-center justify-center rounded-md text-ink-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <Icon size={16} strokeWidth={1.75} aria-hidden />
    </button>
  );
}

/**
 * One activity-timeline row (docs/06 §3.9). Reads as an activity feed: a colour-coded TYPE GLYPH
 * leads (so the kind of activity is scannable at a glance), with the actor's avatar as a small
 * overlapping badge (who), then a literary message, an optional preview, and the relative time.
 * Unread rows carry the `--q-accent` dot + a raised tint. The whole row is a stretched link to the
 * related resource (opening also marks it read); the per-row actions (mark read / archive / delete)
 * sit above the link (`z-10`), revealed on hover + keyboard focus, always visible on touch. `memo`.
 */
export const NotificationRow = memo(function NotificationRow({
  notification,
  onOpen,
  onMarkRead,
  onArchive,
  onDelete,
}: {
  notification: Item;
  /** Fires when the row is opened (navigate) — used to mark read + close a popover. */
  onOpen: (n: Item) => void;
  onMarkRead: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}): ReactElement {
  const view = describeNotification(notification);
  const { actor } = notification;
  const isUnread = notification.status === NotificationStatus.Unread;
  const displayName = actor ? (actor.penName ?? `@${actor.username}`) : null;
  const Icon = view.icon;
  const tone = TONE[view.tone];

  const body = (
    <>
      <p className="text-sm text-ink-secondary">{view.message}</p>
      {view.preview ? (
        <p dir="auto" className="mt-0.5 line-clamp-2 text-sm text-ink-muted">
          {view.preview}
        </p>
      ) : null}
      <time dateTime={notification.createdAt} className="mt-1 block text-xs text-ink-muted">
        {formatRelativeTime(notification.createdAt)}
      </time>
    </>
  );

  return (
    <li className="group relative">
      <div
        className={cn(
          'flex gap-3.5 rounded-xl px-3 py-3.5 transition-colors',
          isUnread ? 'bg-raised/60' : 'hover:bg-raised/40',
        )}
      >
        {/* Activity glyph (the type, leading) + the actor avatar as a small overlapping badge. */}
        <div className="relative shrink-0">
          <span
            className={cn('flex size-11 items-center justify-center rounded-full', tone.circle)}
          >
            <Icon size={20} strokeWidth={1.75} className={tone.glyph} aria-hidden />
          </span>
          {actor ? (
            <span className="absolute -bottom-1 -end-1 rounded-full ring-2 ring-canvas">
              <QAvatar size={22} src={mediaUrl(actor.avatarKey)} name={displayName ?? ''} />
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          {view.link ? (
            <Link
              to={view.link}
              onClick={() => {
                onOpen(notification);
              }}
              className="block rounded-sm after:absolute after:inset-0 after:content-['']"
            >
              {body}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                onOpen(notification);
              }}
              className="block w-full rounded-sm text-start after:absolute after:inset-0 after:content-['']"
            >
              {body}
            </button>
          )}
        </div>

        {/* Unread dot */}
        {isUnread ? (
          <span
            aria-hidden
            className="relative z-10 mt-2 size-2 shrink-0 self-start rounded-full bg-accent"
          />
        ) : null}

        {/* Row actions — revealed on hover/focus (desktop), always shown on touch. */}
        <div className="flex shrink-0 items-start gap-0.5 opacity-100 md:opacity-0 md:transition-opacity md:group-focus-within:opacity-100 md:group-hover:opacity-100">
          {isUnread ? (
            <RowAction
              icon={Check}
              label="Mark as read"
              onClick={() => {
                onMarkRead(notification.id);
              }}
            />
          ) : null}
          <RowAction
            icon={Archive}
            label="Archive notification"
            onClick={() => {
              onArchive(notification.id);
            }}
          />
          <RowAction
            icon={Trash2}
            label="Delete notification"
            onClick={() => {
              onDelete(notification.id);
            }}
          />
        </div>
      </div>
    </li>
  );
});
