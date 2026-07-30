import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@qalam/shared';

import { AppException } from '../../common/exceptions/app.exception';

/** No story graph exists for this owner + story id (missing or foreign — owner-scoped). */
export class StoryNotFoundException extends AppException {
  constructor() {
    super(
      ERROR_CODES.STORY_NOT_FOUND,
      'No story graph found for this story.',
      HttpStatus.NOT_FOUND,
    );
  }
}

/** No such analysis run for this story (missing or foreign). */
export class StoryAnalysisNotFoundException extends AppException {
  constructor() {
    super(
      ERROR_CODES.STORY_ANALYSIS_NOT_FOUND,
      'No such analysis for this story.',
      HttpStatus.NOT_FOUND,
    );
  }
}

/** The submitted story text was empty. */
export class StoryContentEmptyException extends AppException {
  constructor() {
    super(
      ERROR_CODES.STORY_CONTENT_EMPTY,
      'Provide some story text to analyse.',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
