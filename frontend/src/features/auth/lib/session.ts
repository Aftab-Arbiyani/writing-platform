import { Role } from '@qalam/shared';

import { decodeAccessToken } from '@/lib/jwt';
import { useAuthStore } from '@/stores/auth.store';

import { authApi } from '../api/auth.api';
import { getRememberSession } from './remember';

/**
 * Establish an authenticated session from a fresh access token (login / register / OAuth
 * exchange / refresh). The token goes into api-client memory (via the store) and the JWT is
 * decoded for the role UX hint (docs/26 §8) — the server stays authoritative. `isEmailVerified`
 * is only known from login/register bodies; pass `null` (unknown) for refresh/OAuth where it
 * is not returned.
 */
export function establishSession(
  accessToken: string,
  isEmailVerified: boolean | null = null,
): void {
  const decoded = decodeAccessToken(accessToken);
  useAuthStore.getState().setSession({
    accessToken,
    role: decoded?.role ?? Role.User,
    isEmailVerified,
  });
}

/**
 * Boot session restore (docs/32 §3.1). Attempts one silent `/auth/refresh`; a 200 restores the
 * session, a 401 (absent/expired cookie) is the normal visitor path — no error UI. Skipped
 * entirely when "remember me" was off, so the session does not auto-restore. Always resolves
 * to a terminal status (`authenticated` | `anonymous`); never throws.
 */
export async function bootstrapSession(): Promise<void> {
  const store = useAuthStore.getState();
  if (!getRememberSession()) {
    store.setAnonymous();
    return;
  }
  try {
    const { accessToken } = await authApi.refresh();
    establishSession(accessToken, null);
  } catch {
    store.setAnonymous();
  }
}
