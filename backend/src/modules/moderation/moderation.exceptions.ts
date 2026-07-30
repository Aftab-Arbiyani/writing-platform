import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@qalam/shared';

import { AppException } from '../../common/exceptions/app.exception';

export class ReportNotFoundException extends AppException {
  constructor() {
    super(ERROR_CODES.REPORT_NOT_FOUND, 'No such report.', HttpStatus.NOT_FOUND);
  }
}

export class ReportAlreadyResolvedException extends AppException {
  constructor() {
    super(
      ERROR_CODES.REPORT_ALREADY_RESOLVED,
      'This report has already been resolved.',
      HttpStatus.CONFLICT,
    );
  }
}

export class ReportTargetNotFoundException extends AppException {
  constructor() {
    super(
      ERROR_CODES.REPORT_TARGET_NOT_FOUND,
      'The reported content or user no longer exists.',
      HttpStatus.NOT_FOUND,
    );
  }
}

export class ReportSelfException extends AppException {
  constructor() {
    super(
      ERROR_CODES.REPORT_SELF,
      'You cannot report your own content or account.',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class ReportDuplicateException extends AppException {
  constructor() {
    super(
      ERROR_CODES.REPORT_DUPLICATE,
      'You already have an open report for this.',
      HttpStatus.CONFLICT,
    );
  }
}

export class ReportInvalidResolutionException extends AppException {
  constructor(message = 'That resolution is not valid for this report.') {
    super(ERROR_CODES.REPORT_INVALID_RESOLUTION, message, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

export class AppealNotAllowedException extends AppException {
  constructor(message = 'You cannot appeal this report.') {
    super(ERROR_CODES.APPEAL_NOT_ALLOWED, message, HttpStatus.FORBIDDEN);
  }
}

/** A resolution requires a privilege the moderator lacks (e.g. suspend/ban = admin+). */
export class ModerationForbiddenException extends AppException {
  constructor(message: string) {
    super(ERROR_CODES.AUTH_PERMISSION_DENIED, message, HttpStatus.FORBIDDEN);
  }
}

export class AppealNotFoundException extends AppException {
  constructor() {
    super(ERROR_CODES.APPEAL_NOT_FOUND, 'No such appeal.', HttpStatus.NOT_FOUND);
  }
}

export class AppealAlreadyExistsException extends AppException {
  constructor() {
    super(
      ERROR_CODES.APPEAL_ALREADY_EXISTS,
      'An appeal already exists for this report.',
      HttpStatus.CONFLICT,
    );
  }
}

export class AppealAlreadyReviewedException extends AppException {
  constructor() {
    super(
      ERROR_CODES.APPEAL_ALREADY_REVIEWED,
      'This appeal has already been reviewed.',
      HttpStatus.CONFLICT,
    );
  }
}
