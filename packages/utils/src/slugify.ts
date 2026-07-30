/**
 * Unicode-aware slug generation.
 *
 * Qalam slugs are public URL identifiers for pieces (`/p/:slug`) and must work
 * for Hindi (Devanagari) and Urdu (Arabic script) titles, so the allowed set
 * is `\p{L}\p{M}\p{N}` — letters, combining marks (matras, nukta, harakat),
 * and digits in ANY script — never `[a-z0-9]`.
 */

const DEFAULT_MAX_LENGTH = 80;

export interface SlugifyOptions {
  /**
   * Maximum slug length in Unicode code points (default 80).
   * Truncation is code-point-safe and never leaves a trailing hyphen.
   */
  maxLength?: number;
}

/**
 * Converts arbitrary text to a URL-safe slug:
 * 1. trims and lowercases;
 * 2. normalizes to NFKD (compatibility forms like `ﬁ` or presentation-form
 *    Arabic decompose to their canonical characters);
 * 3. replaces every run of disallowed characters (whitespace, punctuation,
 *    symbols) with a single hyphen — which also collapses repeats;
 * 4. trims leading/trailing hyphens;
 * 5. truncates to `maxLength` code points (Array.from avoids splitting
 *    surrogate pairs) and re-trims trailing hyphens.
 */
export function slugify(input: string, options: SlugifyOptions = {}): string {
  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;

  const slug = input
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/gu, '');

  if (Array.from(slug).length <= maxLength) {
    return slug;
  }
  return Array.from(slug).slice(0, maxLength).join('').replace(/-+$/gu, '');
}

/**
 * Appends a uniqueness suffix (e.g. a random 6-char base36 string) to a slug,
 * trimming the base so the combined result stays within `maxLength`.
 *
 * Pure by design: the caller supplies the suffix. The async uniqueness loop
 * belongs in the persistence layer, with this documented shape:
 *
 *   makeUniqueSlug(base: string, exists: (slug: string) => Promise<boolean>): Promise<string>
 *   // try `base` first; while taken, retry with `appendSuffix(base, randomSuffix)`.
 */
export function appendSuffix(
  slug: string,
  suffix: string,
  maxLength: number = DEFAULT_MAX_LENGTH,
): string {
  const room = Math.max(maxLength - suffix.length - 1, 1);
  const base = Array.from(slug).slice(0, room).join('').replace(/-+$/gu, '');
  return `${base}-${suffix}`;
}
