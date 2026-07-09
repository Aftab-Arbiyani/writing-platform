/** App-level constants. Domain vocabulary (enums, limits, error codes) lives in @qalam/shared. */

export const APP_NAME = 'Qalam';

/** localStorage keys owned by this app (theme is the only persisted store — docs/12 §3). */
export const STORAGE_KEYS = {
  theme: 'qalam-theme',
} as const;

/** Cursor pagination sizes (docs/05 §5). */
export const PAGE_SIZE = {
  default: 20,
  max: 50,
} as const;
