import { QBadge, useToast } from '@qalam/ui';
import { Bell } from 'lucide-react';
import { useEffect, useRef, type ReactElement } from 'react';

import { useUnreadCount } from '../hooks/use-unread-count';
import { useNotificationsStore } from '../stores/notifications.store';
import { NotificationPopover } from './notification-popover';

/**
 * The top-bar notification bell (docs/06 §3.9) — a presence DOT (no count on desktop, per the
 * spec) that toggles the recent popover. Freshness is POLLED (no WebSocket in `v1`): when the
 * polled unread count RISES, an unobtrusive toast announces it (gated by the persisted toast
 * preference). Closes on outside-click + Escape. Rendered for signed-in users on md+ (mobile uses
 * the tab-bar destination). ARIA: labelled button, `aria-haspopup="dialog"`, `aria-expanded`.
 */
export function NotificationBell(): ReactElement {
  const unread = useUnreadCount();
  const open = useNotificationsStore((s) => s.popoverOpen);
  const toggle = useNotificationsStore((s) => s.togglePopover);
  const close = useNotificationsStore((s) => s.closePopover);
  const toastsEnabled = useNotificationsStore((s) => s.toastsEnabled);
  const toast = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef<number | null>(null);

  const count = unread.data?.count ?? 0;
  const hasUnread = count > 0;

  // Toast when the polled count rises (polling stands in for real-time — docs/06 §3.9).
  useEffect(() => {
    if (unread.data === undefined) return;
    const prev = prevCountRef.current;
    prevCountRef.current = unread.data.count;
    if (prev !== null && unread.data.count > prev && toastsEnabled) {
      const delta = unread.data.count - prev;
      toast.info(
        delta === 1 ? 'You have a new notification' : `You have ${String(delta)} new notifications`,
      );
    }
  }, [unread.data, toastsEnabled, toast]);

  // Dismiss on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  const srLabel = hasUnread
    ? `Notifications, ${unread.data?.capped ? 'over 99' : String(count)} unread`
    : 'Notifications';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={srLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
        className="inline-flex size-9 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <QBadge dot={hasUnread} srLabel={hasUnread ? 'unread' : 'no unread notifications'}>
          <Bell size={20} strokeWidth={1.75} aria-hidden />
        </QBadge>
      </button>
      {open ? <NotificationPopover onClose={close} /> : null}
    </div>
  );
}
