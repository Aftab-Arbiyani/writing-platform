import type { Role } from '@qalam/shared';
import { create } from 'zustand';

import { setAccessToken } from '@/lib/api-client';

/**
 * Session state — client/session UI, NOT a server-data mirror (docs/12 §1, §7). It holds
 * only "am I signed in + my role hint + is my email verified", never the server user object
 * (penName, counts…), which stays a query in the profile/auth epics. The access token lives
 * in api-client memory; this store keeps it in sync and exposes reactive status for guards.
 *
 * Role is a UX hint decoded from the JWT (docs/26 §8) — the server is always authoritative.
 * `isEmailVerified` is `null` when unknown: it is only returned by login/register, never in
 * the JWT nor by `GET /me`, so after a cold session-restore (silent refresh) we don't know it
 * and must not fabricate a value. Not persisted (session-scoped).
 */
export type SessionStatus = 'unknown' | 'authenticated' | 'anonymous';

interface AuthState {
  status: SessionStatus;
  role: Role | null;
  /** true / false when known (login/register), null when unknown (cold restore). */
  isEmailVerified: boolean | null;
  /** Set when a session ended involuntarily (terminal 401) so login can explain why. */
  sessionExpired: boolean;
  /** Establish a session: stash the access token in api-client memory + set reactive status. */
  setSession: (input: {
    accessToken: string;
    role: Role;
    isEmailVerified?: boolean | null;
  }) => void;
  /** Update just the verified flag (e.g. after a successful email verification). */
  setEmailVerified: (value: boolean) => void;
  /** Boot check finished with no session → visitor mode. */
  setAnonymous: () => void;
  /** Involuntary end (refresh failed / token revoked): clear + flag so login shows a reason. */
  expireSession: () => void;
  /** Clear everything (explicit logout / manual reset). */
  clear: () => void;
  /** Acknowledge the "session expired" reason once shown. */
  clearSessionExpired: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'unknown',
  role: null,
  isEmailVerified: null,
  sessionExpired: false,
  setSession: ({ accessToken, role, isEmailVerified = null }) => {
    setAccessToken(accessToken);
    set({ status: 'authenticated', role, isEmailVerified, sessionExpired: false });
  },
  setEmailVerified: (value) => {
    set({ isEmailVerified: value });
  },
  setAnonymous: () => {
    set({ status: 'anonymous', role: null, isEmailVerified: null });
  },
  expireSession: () => {
    setAccessToken(null);
    set({ status: 'anonymous', role: null, isEmailVerified: null, sessionExpired: true });
  },
  clear: () => {
    setAccessToken(null);
    set({ status: 'anonymous', role: null, isEmailVerified: null, sessionExpired: false });
  },
  clearSessionExpired: () => {
    set({ sessionExpired: false });
  },
}));
