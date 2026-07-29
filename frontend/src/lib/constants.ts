/** App-level constants. Domain vocabulary (enums, limits, error codes) lives in @qalam/shared. */

export const APP_NAME = 'Qalam';

/** localStorage keys owned by this app (docs/12 §3). */
export const STORAGE_KEYS = {
  theme: 'qalam-theme',
  /** Device-local recent searches (mirrors the server list for authed users; sole list for guests). */
  recentSearches: 'qalam-recent-searches',
  /** Reader typography (text size / line spacing / column width) — device-scoped, never synced. */
  readerPreferences: 'qalam-reader',
  /**
   * Last server-authoritative entitlement snapshot (AF5 W4) — a HINT cache so premium gating renders
   * instantly and survives being offline. Never authoritative: the floor is deny and the server
   * re-checks every premium action.
   *
   * The only key here that is **user-scoped rather than device-scoped**, which is why sign-out clears
   * it (`features/auth/hooks/use-logout`) while the others survive: theme, recent searches and reader
   * typography belong to the browser, but an entitlement belongs to an account, and the next account
   * to use this browser must not inherit the last one's plan.
   */
  entitlements: 'qalam.monetization.entitlements',
} as const;

/** Cursor pagination sizes (docs/05 §5). */
export const PAGE_SIZE = {
  default: 20,
  max: 50,
} as const;
