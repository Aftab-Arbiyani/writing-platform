import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@qalam/shared';

import { AppException } from '../../../common/exceptions/app.exception';

/**
 * A cursor was supplied but failed to decode (or is stale/foreign to this feed).
 * 400 — the client must restart from page one (docs 05 §5.1). Distinguished from
 * an ABSENT cursor (first page): only a present-but-malformed value throws.
 */
export class FeedInvalidCursorException extends AppException {
  constructor() {
    super(ERROR_CODES.FEED_INVALID_CURSOR, 'Invalid or expired cursor.', HttpStatus.BAD_REQUEST);
  }
}
