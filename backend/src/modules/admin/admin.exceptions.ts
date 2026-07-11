import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@qalam/shared';

import { AppException } from '../../common/exceptions/app.exception';

/**
 * An admin attempted a destructive action on their own account (suspend,
 * deactivate, force-logout, self-demotion). Blocked to prevent an admin locking
 * themselves out. Reuses the generic `FORBIDDEN` code (403) — no change to the
 * frozen `@qalam/shared` catalogue (E12.5 is additive-only).
 */
export class AdminSelfActionException extends AppException {
  constructor(message = 'You cannot perform this action on your own account.') {
    super(ERROR_CODES.FORBIDDEN, message, HttpStatus.FORBIDDEN);
  }
}
