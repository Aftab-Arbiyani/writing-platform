import { Role } from '@qalam/shared';
import { create } from 'zustand';

import { setAccessToken } from '@/lib/api-client';
import { decodeAccessToken } from '@/lib/jwt';

/**
 * Admin session (client state → Zustand; docs/00 §6). The `role` comes ONLY from the access-token
 * JWT claim (docs/26 §8) — `/me` returns no role. The access token itself lives in api-client memory
 * (never here, never localStorage); this store holds only the derived session state. It's a UX-hint
 * layer for guards + nav filtering — the server re-checks every admin endpoint and audit-logs every
 * mutation, so it is never a trust boundary.
 *
 * `sessionExpired` is the involuntary-logout reason: set by `expireSession` (from the api-client's
 * unauthorized handler on an unrecoverable 401), read by the `SessionExpiredDialog`. `expireSession`
 * deliberately leaves `status` intact so the dialog — not a silent redirect — handles re-auth.
 */
export type SessionStatus = 'unknown' | 'authenticated' | 'anonymous';

interface AuthState {
  status: SessionStatus;
  role: Role | null;
  sessionExpired: boolean;
  /** Establish a session from a fresh access token (login / boot refresh): decode role + stash token. */
  setSession: (accessToken: string) => void;
  /** No session found at boot (remember-me off, or refresh failed). */
  setAnonymous: () => void;
  /** Session died mid-use (unrecoverable 401): drop the token + raise the expired reason. */
  expireSession: () => void;
  /** Explicit sign-out: drop the token + reset to anonymous with no "expired" reason. */
  clear: () => void;
  clearSessionExpired: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'unknown',
  role: null,
  sessionExpired: false,
  setSession: (accessToken) => {
    setAccessToken(accessToken);
    const decoded = decodeAccessToken(accessToken);
    set({ status: 'authenticated', role: decoded?.role ?? Role.User, sessionExpired: false });
  },
  setAnonymous: () => {
    setAccessToken(null);
    set({ status: 'anonymous', role: null });
  },
  expireSession: () => {
    setAccessToken(null);
    set({ sessionExpired: true });
  },
  clear: () => {
    setAccessToken(null);
    set({ status: 'anonymous', role: null, sessionExpired: false });
  },
  clearSessionExpired: () => set({ sessionExpired: false }),
}));
