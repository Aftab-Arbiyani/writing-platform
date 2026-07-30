import { QPageLoader } from '@qalam/ui';
import type { ReactElement } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';

import { ROUTES } from '@/lib/routes';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Gate for authed surfaces (/write, /me/*, /settings, /notifications) — a pathless layout
 * route (docs/11 §3–4). While the boot session check is in flight it renders the loader
 * (never flashes a redirect); with no session it bounces to login carrying `returnTo`.
 */
export function RequireAuth(): ReactElement {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();

  if (status === 'unknown') return <QPageLoader label="Loading your session" />;
  if (status === 'anonymous') {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`${ROUTES.login}?returnTo=${returnTo}`} replace />;
  }
  return <Outlet />;
}
