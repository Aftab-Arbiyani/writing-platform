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

/** The strike referenced by id does not exist. */
export class StrikeNotFoundException extends AppException {
  constructor() {
    super(ERROR_CODES.STRIKE_NOT_FOUND, 'No such strike.', HttpStatus.NOT_FOUND);
  }
}

/**
 * The strike is already revoked. A 409 rather than a silent success: revoking twice
 * would recompute the weight from a ledger that did not change, so an operator who
 * saw "revoked" twice would have no way to tell whether their action did anything.
 */
export class StrikeAlreadyRevokedException extends AppException {
  constructor() {
    super(
      ERROR_CODES.STRIKE_ALREADY_REVOKED,
      'That strike has already been revoked.',
      HttpStatus.CONFLICT,
    );
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
