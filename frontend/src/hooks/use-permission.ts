import { DEFAULT_ROLE_PERMISSIONS, permissionSatisfies, Role, ROLE_RANK } from '@qalam/shared';

import { useAuthStore } from '@/stores/auth.store';

/**
 * Whether the signed-in viewer probably holds a permission — an **affordance hint**, never
 * enforcement (W7a, docs/45 §4.4).
 *
 * The server is always authoritative: `PermissionsGuard` resolves the effective set from the
 * `role_permissions` table (falling back to `DEFAULT_ROLE_PERMISSIONS`) plus any direct user
 * grants, and re-checks it on every write. This mirrors only the static half of that resolution,
 * from the role the JWT carries — the same "role is a UX hint, the server decides" posture
 * `auth.store` already documents.
 *
 * **It mirrors rank inheritance**, which is the part a naive lookup gets wrong: a role's grants
 * STACK with every lower-ranked role's (`permission.resolver.ts:50-54`), so a moderator keeps a
 * user's capabilities. Reading `DEFAULT_ROLE_PERMISSIONS[role]` alone would hide `piece.create`
 * from every moderator and admin, who all hold it.
 *
 * Two things it cannot see, and both fail in the safe direction:
 *   • a **direct user grant** — the viewer holds more than their role implies, and we under-offer;
 *   • a **customized `role_permissions` row** — likewise.
 * Neither can wrongly grant, because the write is still refused server-side. Callers must
 * therefore surface a 403 honestly rather than treating this as the last word.
 */
export function usePermission(code: string): boolean {
  const status = useAuthStore((s) => s.status);
  const role = useAuthStore((s) => s.role);

  if (status !== 'authenticated' || role === null) return false;
  return permissionSatisfies(grantsFor(role), code);
}

/** The role's own grants unioned with every lower-ranked role's — the resolver's `rolesUpTo`. */
function grantsFor(role: Role): ReadonlySet<string> {
  const rank = ROLE_RANK[role];
  const granted = new Set<string>();
  for (const candidate of Object.values(Role)) {
    if (ROLE_RANK[candidate] <= rank) {
      for (const grant of DEFAULT_ROLE_PERMISSIONS[candidate]) granted.add(grant);
    }
  }
  return granted;
}
