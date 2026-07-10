import { QPageLoader } from '@qalam/ui';
import type { ReactElement } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';

import { ROUTES } from '@/lib/routes';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Pathless layout guard (docs/11 §3–§4): renders the protected branch only for an authenticated
 * session. While the boot session check is unresolved it shows a loader — never a redirect flash.
 * An anonymous visitor is sent to login with a `returnTo` so the auth epic can bounce back.
 */
export function RequireAuth(): ReactElement {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();

  if (status === 'unknown') return <QPageLoader label="Loading" />;
  if (status === 'anonymous') {
    return <Navigate to={ROUTES.login} replace state={{ returnTo: location.pathname }} />;
  }
  return <Outlet />;
}
