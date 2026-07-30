import { local } from '@/lib/storage';

/**
 * "Remember me" preference (login). The backend always issues a 30-day httpOnly refresh
 * cookie (docs/13 §3.3) — the browser holds it and JS cannot shorten or read it. So
 * "remember me" is honoured client-side: when OFF, we do NOT attempt the silent boot refresh,
 * so the session is not auto-restored on the next visit (the user signs in again). No token is
 * ever stored here — only this boolean preference (docs/12 §7).
 */
const REMEMBER_KEY = 'qalam.auth.remember';

export function getRememberSession(): boolean {
  return local.get<boolean>(REMEMBER_KEY, true);
}

export function setRememberSession(value: boolean): void {
  local.set(REMEMBER_KEY, value);
}
