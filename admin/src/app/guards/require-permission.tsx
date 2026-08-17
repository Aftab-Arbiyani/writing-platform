import type { PermissionCode } from '@qalam/shared';
import { QPageLoader } from '@qalam/ui';
import type { ReactElement } from 'react';
import { Navigate, Outlet } from 'react-router';

import { Forbidden } from '@/app/pages/forbidden';
import { usePermissions } from '@/hooks/use-permissions';
import { ROUTES } from '@/lib/routes';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Permission guard (A1) — renders the branch only when the viewer's grants satisfy `require`.
 *
 * The sibling of `RequireRole`, and it exists because some route groups are defined by a PERMISSION
 * rather than by a rank. The monetization surface is the first: every one of its endpoints carries
 * `@Permissions(PERMISSIONS.BillingManage)`, so gating its routes on a role floor would name the
 * wrong thing even where the two currently coincide.
 *
 * **They do coincide today, and that is worth stating rather than relying on.** `billing.*` is
 * granted to `Role.Admin` and (by wildcard) `SuperAdmin`, so `billing.manage` and
 * `RequireRole min={Role.Admin}` select the same viewers under `DEFAULT_ROLE_PERMISSIONS`. This guard
 * derives from the same map — `usePermissions` reads the role's default grants — so it is not a
 * second source of truth, just the honest name for the check. If the grant map ever moves
 * `billing.*` off Admin, routes guarded this way follow it and role-guarded ones would not.
 *
 * Same posture as `RequireRole`: an authenticated viewer without the grant gets an honest **403 page,
 * not a redirect**, and this is the FIRST gate only — every admin endpoint re-checks server-side.
 */
export interface RequirePermissionProps {
  require: PermissionCode | string;
}

export function RequirePermission({ require }: RequirePermissionProps): ReactElement {
  const status = useAuthStore((state) => state.status);
  const { can } = usePermissions();

  if (status === 'unknown') return <QPageLoader label="Loading" />;
  if (status === 'anonymous') return <Navigate to={ROUTES.login} replace />;
  if (!can(require)) return <Forbidden />;
  return <Outlet />;
}
