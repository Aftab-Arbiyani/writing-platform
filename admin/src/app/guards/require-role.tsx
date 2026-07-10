import { QPageLoader } from '@qalam/ui';
import type { Role } from '@qalam/shared';
import type { ReactElement } from 'react';
import { Navigate, Outlet } from 'react-router';

import { Forbidden } from '@/app/pages/forbidden';
import { usePermissions } from '@/hooks/use-permissions';
import { ROUTES } from '@/lib/routes';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Role-floor guard (docs/11 §4, §8): renders the branch only when the current role's rank ≥ `min`.
 * A lower authenticated role gets an honest **403 page, not a redirect** ("hiding admin pages from a
 * moderator is confusing; denying is honest"). This is the FIRST gate only — every admin API
 * re-checks server-side. Anonymous → login (defensive; `RequireAuth` normally handles that first).
 */
export interface RequireRoleProps {
  min: Role;
}

export function RequireRole({ min }: RequireRoleProps): ReactElement {
  const status = useAuthStore((state) => state.status);
  const { hasRole } = usePermissions();

  if (status === 'unknown') return <QPageLoader label="Loading" />;
  if (status === 'anonymous') return <Navigate to={ROUTES.login} replace />;
  if (!hasRole(min)) return <Forbidden />;
  return <Outlet />;
}
