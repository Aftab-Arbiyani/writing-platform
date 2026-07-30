/**
 * Safe JSON storage helpers (try/catch around every access — storage can be disabled/full,
 * e.g. private browsing). NOTE: auth tokens are NEVER stored (in-memory only, docs/12 §7).
 * `local` persists across sessions; `session` is per-tab (e.g. reading position, docs/11 §7).
 */
function make(getStore: () => Storage) {
  return {
    get<T>(key: string, fallback: T): T {
      try {
        const raw = getStore().getItem(key);
        return raw !== null ? (JSON.parse(raw) as T) : fallback;
      } catch {
        return fallback;
      }
    },
    set(key: string, value: unknown): void {
      try {
        getStore().setItem(key, JSON.stringify(value));
      } catch {
        /* unavailable/full — no-op */
      }
    },
    remove(key: string): void {
      try {
        getStore().removeItem(key);
      } catch {
        /* no-op */
      }
    },
  };
}

export const local = make(() => window.localStorage);
export const session = make(() => window.sessionStorage);
