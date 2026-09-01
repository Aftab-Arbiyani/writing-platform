import type { ReactElement } from 'react';

import { useAppStore } from '@/stores/app.store';

/**
 * Passive offline notice (docs/06 §4.5 — no offline mode; the editor keeps a local copy).
 *
 * **It names the mobile app on purpose** (docs/48 §4, decided 2026-08-31). Mobile queues
 * like/bookmark/follow taken offline and reconciles them on reconnect through its `SyncEngine`;
 * web has no write queue at all — `public/sw.js` is not even registered. That difference is an
 * accepted divergence rather than a gap to close, but staying silent about it meant a reader who
 * tapped Like on a dead connection was told nothing and simply lost the action. Saying where it
 * DOES work is the cheap half of the fix, and the only half that was missing.
 *
 * Deliberately still one passive line, not a dialog: it must not interrupt reading, which is the
 * one thing that keeps working offline (the service-worker shell + `/offline`).
 */
export function OfflineBanner(): ReactElement | null {
  const isOnline = useAppStore((state) => state.isOnline);
  if (isOnline) return null;
  return (
    <div role="status" className="bg-warning/12 py-1.5 text-center text-sm text-warning-on-tint">
      You&rsquo;re offline &mdash; reconnecting&hellip; Likes, bookmarks and follows aren&rsquo;t
      saved while you&rsquo;re offline here; the Qalam mobile app queues them and syncs when you
      reconnect.
    </div>
  );
}
