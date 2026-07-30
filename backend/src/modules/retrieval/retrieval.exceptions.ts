import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@qalam/shared';

import { AppException } from '../../common/exceptions/app.exception';

/** The query was empty/too short after normalization. */
export class RetrievalQueryInvalidException extends AppException {
  constructor(message = 'Provide a longer search query.') {
    super(ERROR_CODES.RETRIEVAL_QUERY_INVALID, message, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

/** Every planned retrieval source failed — nothing could be retrieved. */
export class RetrievalFailedException extends AppException {
  constructor() {
    super(
      ERROR_CODES.RETRIEVAL_FAILED,
      'Search is temporarily unavailable. Please try again.',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

/** Retrieval exceeded its wall-clock budget before any source returned. */
export class RetrievalTimeoutException extends AppException {
  constructor() {
    super(
      ERROR_CODES.RETRIEVAL_TIMEOUT,
      'Search took too long. Please try a narrower query.',
      HttpStatus.GATEWAY_TIMEOUT,
    );
  }
}

/** A recommendation surface could not be produced. */
export class RecommendationUnavailableException extends AppException {
  constructor() {
    super(
      ERROR_CODES.RECOMMENDATION_UNAVAILABLE,
      'Recommendations are temporarily unavailable.',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

/** No such saved search, or it belongs to another user (privacy-preserving 404). */
export class SavedSearchNotFoundException extends AppException {
  constructor() {
    super(ERROR_CODES.SAVED_SEARCH_NOT_FOUND, 'No such saved search.', HttpStatus.NOT_FOUND);
  }
}

/** The per-user saved-search cap was reached. */
export class SavedSearchLimitExceededException extends AppException {
  constructor() {
    super(
      ERROR_CODES.SAVED_SEARCH_LIMIT_EXCEEDED,
      'You have reached the maximum number of saved searches.',
      HttpStatus.CONFLICT,
    );
  }
}
