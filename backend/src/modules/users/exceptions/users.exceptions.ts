import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@qalam/shared';

import { AppException } from '../../../common/exceptions/app.exception';

/** Domain exceptions for the profile/follow domain (docs 16 §3.4). */

export class UserNotFoundException extends AppException {
  constructor() {
    super(ERROR_CODES.USER_NOT_FOUND, 'No such user.', HttpStatus.NOT_FOUND);
  }
}

export class ProfileForbiddenException extends AppException {
  constructor() {
    super(
      ERROR_CODES.PROFILE_FORBIDDEN,
      'You can only edit your own profile.',
      HttpStatus.FORBIDDEN,
    );
  }
}

export class PrivateAccountException extends AppException {
  constructor() {
    super(ERROR_CODES.USER_PRIVATE_ACCOUNT, 'This account is private.', HttpStatus.FORBIDDEN);
  }
}

export class CannotFollowSelfException extends AppException {
  constructor() {
    super(
      ERROR_CODES.USER_CANNOT_FOLLOW_SELF,
      'You cannot follow yourself.',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class AlreadyFollowingException extends AppException {
  constructor() {
    super(ERROR_CODES.FOLLOW_ALREADY_EXISTS, 'You already follow this user.', HttpStatus.CONFLICT);
  }
}

export class FollowRequestPendingException extends AppException {
  constructor() {
    super(
      ERROR_CODES.FOLLOW_REQUEST_PENDING,
      'A follow request is already pending.',
      HttpStatus.CONFLICT,
    );
  }
}

/** Used for accept/reject on a missing/foreign/non-pending request — never leaks which. */
export class FollowRequestNotFoundException extends AppException {
  constructor() {
    super(ERROR_CODES.FOLLOW_REQUEST_NOT_FOUND, 'No such follow request.', HttpStatus.NOT_FOUND);
  }
}

/**
 * An admin account-state transition that conflicts with the current state
 * (e.g. suspending an already-suspended user, unsuspending an active one). A
 * state conflict → 409 (docs 05 §4). Reuses the generic `CONFLICT` code so no
 * change to the frozen `@qalam/shared` catalogue is needed (E12.5 is additive).
 */
export class UserStatusConflictException extends AppException {
  constructor(message: string) {
    super(ERROR_CODES.CONFLICT, message, HttpStatus.CONFLICT);
  }
}
