import type { Role } from '@qalam/shared';
import { create } from 'zustand';

import { setAccessToken } from '@/lib/api-client';

/**
 * Session state — client/session UI, NOT a server-data mirror (docs/12 §1, §7). It holds
 * only "am I signed in + my role hint", never the server user object (penName, counts…),
 * which stays a query (`qk.auth.me`) in the profile/auth epics. The access token lives in
 * api-client memory; this store keeps it in sync and exposes reactive status for guards.
 *
 * Role is a UX hint decoded from the JWT (docs/26 §8) — the server is always authoritative.
 * F1 ships the store; the boot-refresh that flips status to 'authenticated' lands in the
 * auth epic. Not persisted (session-scoped).
 */
export type SessionStatus = 'unknown' | 'authenticated' | 'anonymous';

interface AuthState {
  status: SessionStatus;
  role: Role | null;
  isEmailVerified: boolean;
  /** Establish a session: stash the access token in api-client memory + set reactive status. */
  setSession: (input: { accessToken: string; role: Role; isEmailVerified?: boolean }) => void;
  /** Boot check finished with no session → visitor mode. */
  setAnonymous: () => void;
  /** Clear everything (logout / refresh failure). */
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'unknown',
  role: null,
  isEmailVerified: false,
  setSession: ({ accessToken, role, isEmailVerified = false }) => {
    setAccessToken(accessToken);
    set({ status: 'authenticated', role, isEmailVerified });
  },
  setAnonymous: () => {
    set({ status: 'anonymous', role: null, isEmailVerified: false });
  },
  clear: () => {
    setAccessToken(null);
    set({ status: 'anonymous', role: null, isEmailVerified: false });
  },
}));
