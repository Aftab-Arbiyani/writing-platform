import { Role } from '@qalam/shared';
import { create } from 'zustand';

/**
 * Admin session (client state → Zustand; docs/00 §6). Role comes ONLY from the JWT `role` claim
 * (docs/26 §8) — there is no role field in response bodies and no `/me/permissions` endpoint. This
 * store is a UX-hint layer for guards + nav filtering; the server re-checks every admin endpoint and
 * audit-logs every mutation, so this is never a trust boundary.
 *
 * ── FOUNDATION STUB ──
 * A1 ships no authentication UI (out of scope) and there is no way to obtain a real token yet, so
 * the session is seeded as an authenticated super_admin. The auth epic replaces `bootstrapSession`
 * with a real boot `POST /auth/refresh` → decode the JWT `role` (docs/32 §3) and wires login/logout.
 * TODO(admin-auth): remove the seeded session; resolve status from the refresh call at boot.
 */
export type SessionStatus = 'unknown' | 'authenticated' | 'anonymous';

export interface AdminUser {
  name: string;
  email: string;
  role: Role;
}

interface AuthState {
  status: SessionStatus;
  user: AdminUser | null;
  setSession: (user: AdminUser) => void;
  clearSession: () => void;
}

// Seeded stub — see the file header. Replace with a real refresh-on-boot in the auth epic.
const STUB_USER: AdminUser = {
  name: 'Admin',
  email: 'admin@qalam.local',
  role: Role.SuperAdmin,
};

export const useAuthStore = create<AuthState>((set) => ({
  status: 'authenticated',
  user: STUB_USER,
  setSession: (user) => {
    set({ status: 'authenticated', user });
  },
  clearSession: () => {
    set({ status: 'anonymous', user: null });
  },
}));

/** Current role, or null when unauthenticated. Consumed by `usePermissions` + nav filtering. */
export function currentRole(): Role | null {
  return useAuthStore.getState().user?.role ?? null;
}
