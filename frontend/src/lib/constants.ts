/** App-level constants. Domain vocabulary (enums, limits, error codes) lives in @qalam/shared. */

export const APP_NAME = 'Qalam';

/** localStorage keys owned by this app (docs/12 §3). */
export const STORAGE_KEYS = {
  theme: 'qalam-theme',
  /** Device-local recent searches (mirrors the server list for authed users; sole list for guests). */
  recentSearches: 'qalam-recent-searches',
  /** Reader typography (text size / line spacing / column width) — device-scoped, never synced. */
  readerPreferences: 'qalam-reader',
} as const;

/** Cursor pagination sizes (docs/05 §5). */
export const PAGE_SIZE = {
  default: 20,
  max: 50,
} as const;
