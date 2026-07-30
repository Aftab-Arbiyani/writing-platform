/**
 * "Remember me" gate (client-only). The backend has no remember-me param — it always issues the
 * same 30-day refresh cookie — so this is purely a UX preference deciding whether to ATTEMPT a
 * silent session restore on a cold load (docs/32 §3). Only a boolean is persisted; **no token or
 * sensitive data ever touches localStorage** (the access token stays in memory, the refresh token in
 * an httpOnly cookie).
 */
const KEY = 'qalam-admin-remember';

export function getRemember(): boolean {
  try {
    return localStorage.getItem(KEY) === 'true';
  } catch {
    return false;
  }
}

export function setRemember(value: boolean): void {
  try {
    if (value) localStorage.setItem(KEY, 'true');
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable — remember-me simply won't persist */
  }
}
