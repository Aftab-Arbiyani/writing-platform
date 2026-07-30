import type { ReactElement } from 'react';

import { env } from '@/config/env';

/**
 * Slim admin footer — build/env provenance for operators. Not a marketing footer; the admin is a
 * console. Rendered as a `contentinfo` landmark once at the bottom of the shell content.
 */
export function AppFooter(): ReactElement {
  return (
    <footer className="border-t border-line px-6 py-3 text-xs text-ink-muted">
      Qalam Admin — an internal operations console.
      {env.VITE_APP_ENV !== 'production' ? ` (${env.VITE_APP_ENV})` : ''}
    </footer>
  );
}
