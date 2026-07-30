/**
 * Reading-time estimation. `word_count` and `reading_time_seconds` are
 * computed on write and stored denormalized (ADR §4) — these are the
 * canonical functions for that computation.
 */

const DEFAULT_WPM = 200;

/**
 * CJK scripts (Han, Kana, Hangul) do not separate words with spaces, so each
 * CJK character is counted as one word — the standard reading-time
 * approximation. Hindi/Urdu DO use spaces, so they flow through the
 * whitespace-token path below.
 *
 * Ranges (as \u escapes so tooling can never mangle the literals):
 * Hiragana+Katakana, CJK Ext A, CJK Unified, CJK Compatibility, Hangul.
 */
const CJK_CHAR_REGEX = /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uAC00-\uD7AF]/gu;

/**
 * Unicode-aware word count: CJK characters count individually; the remainder
 * is split on whitespace and only tokens containing at least one letter or
 * digit (any script) count — bare punctuation like `—` or `!!` does not.
 */
export function countWords(text: string): number {
  if (!text) {
    return 0;
  }
  const cjkCount = text.match(CJK_CHAR_REGEX)?.length ?? 0;
  const tokens = text
    .replace(CJK_CHAR_REGEX, ' ')
    .split(/\s+/u)
    .filter((token) => /[\p{L}\p{N}]/u.test(token));
  return cjkCount + tokens.length;
}

/**
 * Estimated reading time in SECONDS for a given word count.
 * @param wordCount total words (see countWords)
 * @param wpm words per minute (default 200 — average silent reading speed)
 */
export function readingTime(wordCount: number, wpm: number = DEFAULT_WPM): number {
  if (wordCount <= 0 || wpm <= 0) {
    return 0;
  }
  return Math.ceil((wordCount / wpm) * 60);
}
