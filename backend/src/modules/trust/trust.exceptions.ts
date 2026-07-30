import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@qalam/shared';

import { AppException } from '../../common/exceptions/app.exception';

/** No trust profile exists for the requested user. */
export class TrustProfileNotFoundException extends AppException {
  constructor() {
    super(
      ERROR_CODES.TRUST_PROFILE_NOT_FOUND,
      'No trust profile exists for this user.',
      HttpStatus.NOT_FOUND,
    );
  }
}

/** The restriction referenced by id does not exist. */
export class RestrictionNotFoundException extends AppException {
  constructor() {
    super(ERROR_CODES.RESTRICTION_NOT_FOUND, 'No such restriction.', HttpStatus.NOT_FOUND);
  }
}

/** A user tried to block or mute themselves. */
export class BlockSelfException extends AppException {
  constructor() {
    super(ERROR_CODES.BLOCK_SELF, 'You cannot block or mute yourself.', HttpStatus.CONFLICT);
  }
}

/** Removing a block/mute that isn't there. */
export class BlockNotFoundException extends AppException {
  constructor() {
    super(ERROR_CODES.BLOCK_NOT_FOUND, 'No such block to remove.', HttpStatus.NOT_FOUND);
  }
}
