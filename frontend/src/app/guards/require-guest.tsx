import { QPageLoader } from '@qalam/ui';
import type { ReactElement } from 'react';
import { Navigate, Outlet, useSearchParams } from 'react-router';

import { ROUTES } from '@/lib/routes';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Gate for guest-only surfaces (/auth/*). Logged-in users never see auth pages — they are
 * sent to a validated same-origin `returnTo` (open-redirect defense) or /feed (docs/11 §4).
 */
export function RequireGuest(): ReactElement {
  const status = useAuthStore((state) => state.status);
  const [params] = useSearchParams();

  if (status === 'unknown') return <QPageLoader label="Loading" />;
  if (status === 'authenticated') {
    const returnTo = params.get('returnTo');
    const safe = returnTo && returnTo.startsWith('/') ? returnTo : ROUTES.feed;
    return <Navigate to={safe} replace />;
  }
  return <Outlet />;
}
