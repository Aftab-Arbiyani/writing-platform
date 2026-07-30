import { QPageLoader } from '@qalam/ui';
import type { ReactElement } from 'react';
import { Navigate, Outlet } from 'react-router';

import { ROUTES } from '@/lib/routes';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Inverse of `RequireAuth` (docs/11 §3–§4): the guest-only branch (e.g. sign-in). An already
 * authenticated operator is sent to the dashboard rather than shown a login screen.
 */
export function RequireGuest(): ReactElement {
  const status = useAuthStore((state) => state.status);

  if (status === 'unknown') return <QPageLoader label="Loading" />;
  if (status === 'authenticated') return <Navigate to={ROUTES.dashboard} replace />;
  return <Outlet />;
}
