import { QCard } from '@qalam/ui';
import type { ReactElement } from 'react';

import { usePageTitle } from '@/hooks/use-page-title';

/**
 * Sign-in placeholder (lazy route, guest branch). A1 ships NO authentication UI (out of scope) — the
 * real sign-in form + credential/refresh flow land in the admin auth epic. This proves the auth
 * corridor (`AuthLayout` + `RequireGuest`) is wired.
 */
export function Component(): ReactElement {
  usePageTitle('Sign in');
  return (
    <QCard padding="lg" className="flex flex-col gap-2 text-center">
      <h1 className="text-xl font-semibold text-ink">Qalam Admin</h1>
      <p className="text-sm text-ink-secondary">
        Sign-in arrives in the admin authentication epic. The auth corridor is wired and ready.
      </p>
    </QCard>
  );
}
