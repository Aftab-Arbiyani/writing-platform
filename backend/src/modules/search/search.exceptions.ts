import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES, SEARCH_QUERY_MIN } from '@qalam/shared';

import { AppException } from '../../common/exceptions/app.exception';

/** Domain exceptions for search (E8; docs 16 §3.4, error codes in docs 05 §3.2). */

/** `q` shorter than the minimum after normalization (docs 05 §3.2 → 400). */
export class SearchQueryTooShortException extends AppException {
  constructor() {
    super(
      ERROR_CODES.SEARCH_QUERY_TOO_SHORT,
      `Search query must be at least ${SEARCH_QUERY_MIN} characters.`,
      HttpStatus.BAD_REQUEST,
    );
  }
}

/** FTS backend errored/unreachable — client retries with backoff (docs 05 §3.2 → 503). */
export class SearchUnavailableException extends AppException {
  constructor() {
    super(
      ERROR_CODES.SEARCH_UNAVAILABLE,
      'Search is temporarily unavailable. Please retry shortly.',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

/**
 * A cursor was supplied but failed to decode/verify. Reuses the shared
 * `FEED_INVALID_CURSOR` wire code (docs 05 §5.1 — the generic "restart from page
 * one" contract) without coupling to the feed module.
 */
export class SearchInvalidCursorException extends AppException {
  constructor() {
    super(ERROR_CODES.FEED_INVALID_CURSOR, 'Invalid or expired cursor.', HttpStatus.BAD_REQUEST);
  }
}

/** Deleting a recent-search row that does not exist or is not the caller's (→ 404). */
export class SearchRecentNotFoundException extends AppException {
  constructor() {
    super(ERROR_CODES.SEARCH_RECENT_NOT_FOUND, 'No such recent search.', HttpStatus.NOT_FOUND);
  }
}
