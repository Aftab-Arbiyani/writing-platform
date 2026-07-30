import { env } from '@/config/env';
import { session } from '@/lib/storage';

/**
 * Google OAuth is a redirect dance, NOT a fetch (docs/11 §10.2, docs/32 §3.3). We must do a
 * top-level navigation to `GET /auth/google` so the browser follows the 302 and stores the
 * httpOnly refresh cookie the callback sets. The backend redirect target is fixed
 * (`${APP_URL}/auth/callback?code=…`) and cannot carry our `returnTo`, so we stash it in
 * sessionStorage (per-tab) and the callback page reads it back.
 */
const RETURN_TO_KEY = 'qalam.auth.oauthReturnTo';

export function startGoogleLogin(returnTo?: string): void {
  if (returnTo && returnTo.startsWith('/')) {
    session.set(RETURN_TO_KEY, returnTo);
  } else {
    session.remove(RETURN_TO_KEY);
  }
  // Top-level navigation (not fetch) — the browser follows the 302 and stores the cookie.
  window.location.assign(`${env.VITE_API_URL}/auth/google`);
}

/** Read (and clear) the returnTo stashed before the OAuth redirect. */
export function takeGoogleReturnTo(): string | null {
  const value = session.get<string | null>(RETURN_TO_KEY, null);
  session.remove(RETURN_TO_KEY);
  return value && value.startsWith('/') ? value : null;
}
