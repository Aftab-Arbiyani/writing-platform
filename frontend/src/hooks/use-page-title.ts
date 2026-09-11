import { useEffect } from 'react';

import { APP_NAME } from '@/lib/constants';

/**
 * Sets `document.title` to `"{title} · Umberleaf"` (or just "Umberleaf" when omitted) and restores
 * the previous title on unmount. Native + bulletproof — the primary title mechanism
 * (docs/11 §7); `HelmetProvider` is still mounted for richer meta on public pages.
 */
export function usePageTitle(title?: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
