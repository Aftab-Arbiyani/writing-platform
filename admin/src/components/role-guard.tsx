import type { Role } from '@qalam/shared';
import type { ReactElement, ReactNode } from 'react';

import { usePermissions } from '@/hooks/use-permissions';

/**
 * Conditionally renders `children` only when the current role meets a minimum rank (floor check).
 * The COMPONENT-level counterpart to the route guard `RequireRole` — use it to hide/deny in-page
 * affordances (buttons, sections, menu items). Renders `fallback` (default: nothing) otherwise.
 * A UX hint only — the server re-checks every mutation (docs/26 §8).
 */
export interface RoleGuardProps {
  min: Role;
  children: ReactNode;
  fallback?: ReactNode;
}

export function RoleGuard({ min, children, fallback = null }: RoleGuardProps): ReactElement {
  const { hasRole } = usePermissions();
  return <>{hasRole(min) ? children : fallback}</>;
}
