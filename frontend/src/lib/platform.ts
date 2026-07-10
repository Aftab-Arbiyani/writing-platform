/** Platform helpers. Kept out of component files so Fast Refresh only sees component exports. */

/** True on macOS — used to show ⌘ vs Ctrl in keyboard hints. */
export const IS_MAC =
  typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent);
