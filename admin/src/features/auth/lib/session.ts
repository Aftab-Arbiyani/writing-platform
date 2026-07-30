import { getRemember } from '@/lib/remember';
import { useAuthStore } from '@/stores/auth.store';

import { authApi } from '../api/auth.api';

/**
 * Boot session restore (docs/32 §3.1). Runs once at startup: if remember-me is off, resolve straight
 * to anonymous (no silent restore); otherwise attempt ONE `POST /auth/refresh` (the httpOnly cookie
 * rides along) → decode the returned access token for the role → establish the session. Always
 * terminal, never throws — a failure just means "sign in". No `/me` call here; identity is a separate
 * `useMe` query gated on the resolved status.
 */
export async function bootstrapSession(): Promise<void> {
  const store = useAuthStore.getState();
  if (!getRemember()) {
    store.setAnonymous();
    return;
  }
  try {
    const { accessToken } = await authApi.refresh();
    store.setSession(accessToken);
  } catch {
    store.setAnonymous();
  }
}
