import type { PermissionCode } from '@qalam/shared';
import type { ReactElement, ReactNode } from 'react';

import { usePermissions } from '@/hooks/use-permissions';

/**
 * Conditionally renders `children` only when the current role's default grants satisfy a permission
 * code (supports `resource.*` and `*` wildcards, via `@qalam/shared`). Use for permission-gated
 * in-page affordances. Renders `fallback` (default: nothing) otherwise. A UX hint only — the server
 * re-checks every mutation (docs/26 §8).
 */
export interface PermissionGuardProps {
  require: PermissionCode | string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGuard({
  require,
  children,
  fallback = null,
}: PermissionGuardProps): ReactElement {
  const { can } = usePermissions();
  return <>{can(require) ? children : fallback}</>;
}
