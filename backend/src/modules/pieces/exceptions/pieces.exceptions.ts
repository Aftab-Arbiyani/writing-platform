import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@qalam/shared';

import { AppException } from '../../../common/exceptions/app.exception';

/** Domain exceptions for the writing lifecycle (docs 16 §3.4). */

export class PieceNotFoundException extends AppException {
  constructor() {
    super(ERROR_CODES.PIECE_NOT_FOUND, 'No such piece.', HttpStatus.NOT_FOUND);
  }
}

export class PieceForbiddenException extends AppException {
  constructor() {
    super(
      ERROR_CODES.PIECE_FORBIDDEN,
      'You can only modify your own pieces.',
      HttpStatus.FORBIDDEN,
    );
  }
}

export class PieceScheduleInPastException extends AppException {
  constructor() {
    super(
      ERROR_CODES.PIECE_SCHEDULE_IN_PAST,
      'Scheduled time must be in the future.',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class PieceAlreadyPublishedException extends AppException {
  constructor() {
    super(
      ERROR_CODES.PIECE_ALREADY_PUBLISHED,
      'This piece is already published.',
      HttpStatus.CONFLICT,
    );
  }
}

export class PieceNotPublishedException extends AppException {
  constructor() {
    super(ERROR_CODES.PIECE_NOT_PUBLISHED, 'This piece is not published.', HttpStatus.CONFLICT);
  }
}

export class PieceInvalidTransitionException extends AppException {
  constructor(from: string, to: string) {
    super(
      ERROR_CODES.PIECE_INVALID_TRANSITION,
      `Cannot move a piece from "${from}" to "${to}".`,
      HttpStatus.CONFLICT,
    );
  }
}

export class PieceIncompleteException extends AppException {
  constructor(missing: string[]) {
    super(
      ERROR_CODES.PIECE_INCOMPLETE,
      `Cannot publish — missing required field(s): ${missing.join(', ')}.`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      missing,
    );
  }
}

export class PieceContentInvalidException extends AppException {
  constructor(reason: string) {
    super(
      ERROR_CODES.PIECE_CONTENT_INVALID,
      `Invalid content: ${reason}`,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
