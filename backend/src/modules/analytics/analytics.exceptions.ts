import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@qalam/shared';

import { AppException } from '../../common/exceptions/app.exception';

/** No such piece (or soft-deleted) when requesting its analytics. */
export class AnalyticsPieceNotFoundException extends AppException {
  constructor() {
    super(ERROR_CODES.PIECE_NOT_FOUND, 'No such piece.', HttpStatus.NOT_FOUND);
  }
}

/** Piece analytics are owner-only; the requester is not the author. */
export class AnalyticsForbiddenException extends AppException {
  constructor() {
    super(
      ERROR_CODES.PIECE_FORBIDDEN,
      'You can only view analytics for your own pieces.',
      HttpStatus.FORBIDDEN,
    );
  }
}
