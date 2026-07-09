import type { ReactElement } from 'react';

import { useAppStore } from '@/stores/app.store';

/** Passive offline notice (docs/06 §4.5 — no offline mode; the editor keeps a local copy). */
export function OfflineBanner(): ReactElement | null {
  const isOnline = useAppStore((state) => state.isOnline);
  if (isOnline) return null;
  return (
    <div role="status" className="bg-warning/12 py-1.5 text-center text-sm text-warning">
      You&rsquo;re offline &mdash; reconnecting&hellip;
    </div>
  );
}
