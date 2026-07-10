import { useEffect } from 'react';

import { env } from '@/config/env';

/**
 * Sets `document.title` to `"{title} · Qalam Admin"` (docs/11 §7), prefixing a `[staging]` /
 * `[development]` env badge outside production so an operator always knows which environment a tab
 * is pointed at. Restores the previous title on unmount. Native + bulletproof; HelmetProvider is
 * mounted for any richer per-page meta.
 */
const BASE = 'Qalam Admin';

export function usePageTitle(title?: string): void {
  useEffect(() => {
    const previous = document.title;
    const envPrefix = env.VITE_APP_ENV === 'production' ? '' : `[${env.VITE_APP_ENV}] `;
    document.title = `${envPrefix}${title ? `${title} · ${BASE}` : BASE}`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
