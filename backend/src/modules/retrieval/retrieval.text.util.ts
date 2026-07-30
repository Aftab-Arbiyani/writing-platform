/**
 * Pure text/scoring helpers for the Retrieval Platform (AF4). No I/O, no DI — trivially
 * unit-testable. Token estimation mirrors AF1's char-ratio pre-count (authoritative token
 * counts still come from the provider after a call); lexical scoring is the deterministic
 * relevance signal used until a vector/embedding backend lands behind the vector source.
 */
import { RETRIEVAL_CHARS_PER_TOKEN } from './retrieval.constants';

/** Clamp a number into [0, 1]. */
export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Heuristic token pre-count (guardrail only; provider usage is authoritative). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / RETRIEVAL_CHARS_PER_TOKEN);
}

const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'is',
  'are',
  'was',
  'were',
  'who',
  'what',
  'when',
  'where',
  'why',
  'how',
  'does',
  'do',
  'did',
  'about',
  'with',
  'for',
  'this',
  'that',
  'it',
  'as',
  'at',
  'by',
  'be',
  'from',
  'my',
  'me',
  'i',
]);

/** Split a query into normalized, de-duplicated content terms (stopwords dropped). */
export function tokenizeQuery(query: string): string[] {
  const raw = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
  return Array.from(new Set(raw));
}

/**
 * Lexical relevance (0..1) of a target text to the query terms. Rewards whole-term
 * matches, gives partial credit for substring matches, and a small bonus for phrase
 * containment. Deterministic — the baseline signal the ranker blends with graph/
 * popularity/freshness signals, and the placeholder the vector source will augment.
 */
export function lexicalScore(queryTerms: string[], target: string): number {
  if (queryTerms.length === 0) return 0;
  const hay = target.toLowerCase();
  if (hay === '') return 0;
  const hayTerms = new Set(hay.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/));
  let hits = 0;
  for (const term of queryTerms) {
    if (hayTerms.has(term)) hits += 1;
    else if (hay.includes(term)) hits += 0.5;
  }
  const coverage = hits / queryTerms.length;
  return clamp01(coverage);
}

/** Truncate text to an approximate token budget on a word boundary, appending an ellipsis. */
export function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = Math.max(0, maxTokens) * RETRIEVAL_CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace > maxChars * 0.6 ? slice.slice(0, lastSpace) : slice).trimEnd()}…`;
}

/** Normalize a percentage-or-fraction confidence to 0..1 (graph nodes store 0..100 or 0..1). */
export function normalizeConfidence(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return clamp01(value > 1 ? value / 100 : value);
}

/** Diminishing-returns normalization of an unbounded count (mentions, followers) to 0..1. */
export function saturating(count: number, halfway: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return clamp01(count / (count + Math.max(1, halfway)));
}
