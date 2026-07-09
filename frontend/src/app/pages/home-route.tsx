import { QPageLoader } from '@qalam/ui';
import type { ReactElement } from 'react';
import { Navigate } from 'react-router';

import { Landing } from '@/app/pages/placeholder-home';
import { ROUTES } from '@/lib/routes';
import { useAuthStore } from '@/stores/auth.store';

/**
 * The `/` route (docs/11 §10): signed-in readers are sent to their feed (home); visitors see
 * the landing page. While the boot session check is unresolved we hold on a loader rather than
 * flashing the visitor landing to a returning user.
 */
export function HomeRoute(): ReactElement {
  const status = useAuthStore((s) => s.status);
  if (status === 'unknown') return <QPageLoader label="Loading" />;
  if (status === 'authenticated') return <Navigate to={ROUTES.feed} replace />;
  return <Landing />;
}
