import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@qalam/shared';

import { AppException } from '../../common/exceptions/app.exception';

/** Domain exceptions for notifications (E9; docs 16 §3.4). */

/**
 * No such notification, or it isn't the caller's. Reported as 404 (never 403) so
 * a user can't probe another user's notification ids (privacy-preserving).
 */
export class NotificationNotFoundException extends AppException {
  constructor() {
    super(ERROR_CODES.NOTIFICATION_NOT_FOUND, 'No such notification.', HttpStatus.NOT_FOUND);
  }
}

/**
 * A cursor was supplied but failed to decode. Reuses the shared
 * `FEED_INVALID_CURSOR` wire code (docs 05 §5.1) — the client restarts from page
 * one — without coupling to the feed module.
 */
export class NotificationInvalidCursorException extends AppException {
  constructor() {
    super(ERROR_CODES.FEED_INVALID_CURSOR, 'Invalid or expired cursor.', HttpStatus.BAD_REQUEST);
  }
}

/** Admin system-notification target does not exist. */
export class SystemNotificationNotFoundException extends AppException {
  constructor() {
    super(
      ERROR_CODES.SYSTEM_NOTIFICATION_NOT_FOUND,
      'No such system notification.',
      HttpStatus.NOT_FOUND,
    );
  }
}
