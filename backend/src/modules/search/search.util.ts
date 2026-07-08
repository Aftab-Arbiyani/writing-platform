import { SEARCH_QUERY_MAX } from '@qalam/shared';

import { decodeCursor, type CursorPayload } from '../../common/pagination/cursor.util';
import { SearchInvalidCursorException } from './search.exceptions';

/**
 * Canonical normalization applied to EVERY search term before it touches the DB
 * (docs 13 §6): NFC-normalize (so Hindi/Urdu diacritic sequences compare equal),
 * strip control characters, collapse whitespace, trim, lowercase (matching is
 * case-insensitive), and cap at 256 chars (never reject a paste — trim it).
 *
 * The one canonical form is reused for the FTS/tsquery input, the trigram
 * similarity input, the stored `recent_searches.query`, and the
 * `search_keywords.keyword` — so de-duplication and matching all agree. The DB
 * side applies `immutable_unaccent`, mirroring how the stored tsvectors were
 * built (docs 04 §6.2).
 */
export function normalizeSearchQuery(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/\p{Cc}/gu, ' ') // control characters → space
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase()
    .slice(0, SEARCH_QUERY_MAX);
}

/** Escapes LIKE metacharacters so a user typing `50%` can't widen the match. */
function escapeLike(normalized: string): string {
  return normalized.replace(/[\\%_]/gu, (c) => `\\${c}`);
}

/** Pattern for an `ILIKE 'q%'` prefix match (autocomplete, name lookups). */
export function toPrefixPattern(normalized: string): string {
  return `${escapeLike(normalized)}%`;
}

/**
 * Pattern for an `ILIKE '%q%'` substring match — used for the featured quote,
 * which is NOT in the FTS vector (docs 04 §6.2); the trigram GIN on the column
 * keeps even this leading-wildcard match index-accelerated.
 */
export function toContainsPattern(normalized: string): string {
  return `%${escapeLike(normalized)}%`;
}

/**
 * Cursor contract for search list endpoints (docs 05 §5.1): an absent cursor is
 * the first page; a present-but-malformed cursor is a client error
 * (`FEED_INVALID_CURSOR`, 400) — the client must restart from page one.
 */
export function parseSearchCursor(raw: string | undefined): CursorPayload | null {
  if (raw === undefined || raw === '') {
    return null;
  }
  const decoded = decodeCursor(raw);
  if (decoded === null) {
    throw new SearchInvalidCursorException();
  }
  return decoded;
}

/** Splits a comma-separated multi-value filter (OR semantics), dropping blanks. */
export function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}
