/**
 * Shared validation/extraction regexes.
 *
 * Unicode notes for Hindi (Devanagari) and Urdu (Arabic script):
 * ASCII classes like `\w` silently reject or split Devanagari matras and
 * Arabic harakat because those are COMBINING MARKS, not letters. Content-facing
 * patterns therefore use Unicode property escapes with the `u` flag:
 *   \p{L} letters in any script · \p{M} combining marks (matras, nukta,
 *   harakat) · \p{N} digits (including Devanagari ०-९ and Extended
 *   Arabic-Indic ۰-۹).
 *
 * Note: the `g` regexes are stateful via `lastIndex` when used with `.exec()`
 * or `.test()` — prefer `text.matchAll(HASHTAG_REGEX)`.
 */

/**
 * Usernames are deliberately ASCII-only: they are permanent, URL-path-safe
 * identifiers (`/@:username`), 3–30 chars (ADR §4 identity rules).
 */
export const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;

/**
 * Extracts hashtags in any script — `#कविता`, `#شاعری`, `#poetry` all match.
 * `\p{M}` is essential: without it a matra/harakat terminates the match.
 */
export const HASHTAG_REGEX = /#([\p{L}\p{M}\p{N}_]+)/gu;

/**
 * Extracts @mentions. Mention targets are usernames, so the character class
 * intentionally mirrors USERNAME_REGEX (ASCII) rather than the Unicode set.
 */
export const MENTION_REGEX = /@([a-z0-9_]{3,30})/g;
