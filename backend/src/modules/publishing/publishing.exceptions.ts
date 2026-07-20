import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@qalam/shared';

import { AppException } from '../../common/exceptions/app.exception';

/** Domain exceptions for the editorial publishing layer (AF6). */

/** No review session exists for the story. */
export class ReviewNotFoundException extends AppException {
  constructor() {
    super(
      ERROR_CODES.REVIEW_NOT_FOUND,
      'No review session found for this story.',
      HttpStatus.NOT_FOUND,
    );
  }
}

/** The review session is not in a state that permits this decision. */
export class ReviewInvalidStateException extends AppException {
  constructor() {
    super(
      ERROR_CODES.REVIEW_INVALID_STATE,
      'The review is not in a state that allows this action.',
      HttpStatus.CONFLICT,
    );
  }
}

/** An open review session already exists for the story. */
export class ReviewAlreadyRequestedException extends AppException {
  constructor() {
    super(
      ERROR_CODES.REVIEW_ALREADY_REQUESTED,
      'A review has already been requested for this story.',
      HttpStatus.CONFLICT,
    );
  }
}

/** The story is review-gated and its review is not yet approved. */
export class PublicationNotApprovedException extends AppException {
  constructor() {
    super(
      ERROR_CODES.PUBLICATION_NOT_APPROVED,
      'This story must be approved in review before it can be published.',
      HttpStatus.CONFLICT,
    );
  }
}

/** No such snapshot for the story. */
export class SnapshotNotFoundException extends AppException {
  constructor() {
    super(ERROR_CODES.SNAPSHOT_NOT_FOUND, 'No such snapshot.', HttpStatus.NOT_FOUND);
  }
}
