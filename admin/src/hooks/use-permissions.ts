import {
  DEFAULT_ROLE_PERMISSIONS,
  Role,
  ROLE_RANK,
  permissionSatisfies,
  type PermissionCode,
} from '@qalam/shared';
import { useMemo } from 'react';

import { useAuthStore } from '@/stores/auth.store';

/**
 * Client-side permission/role checks — **UX hints only** (docs/26 §8). The router `RequireRole`
 * gate and every admin API guard re-check server-side; these helpers just decide what to render.
 * Role comes from the session (JWT `role` claim); permissions are the role's default grant set.
 */
export interface Permissions {
  role: Role | null;
  /** True when the current role's rank ≥ the required role's rank (floor check; docs/11 §4). */
  hasRole: (minimum: Role) => boolean;
  /** True when the current role's default grants satisfy a permission code (supports wildcards). */
  can: (permission: PermissionCode | string) => boolean;
}

export function usePermissions(): Permissions {
  const role = useAuthStore((state) => state.user?.role ?? null);

  return useMemo<Permissions>(() => {
    const granted = new Set<string>(role ? DEFAULT_ROLE_PERMISSIONS[role] : []);
    return {
      role,
      hasRole: (minimum) => role !== null && ROLE_RANK[role] >= ROLE_RANK[minimum],
      can: (permission) => permissionSatisfies(granted, permission),
    };
  }, [role]);
}

export { Role };
