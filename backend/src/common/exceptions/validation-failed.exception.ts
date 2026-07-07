import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@qalam/shared';

import { AppException } from './app.exception';

/** One field-level validation issue (docs 05 §3 "details format"). */
export interface ValidationErrorDetail {
  /** Dot/bracket path to the offending field (`profile.penName`, `tags[5]`). */
  field: string;
  /** class-validator constraint name (`isEmail`, `matches`) — clients map to copy. */
  rule: string;
  /** Human-readable message (never parsed by clients). */
  message: string;
}

/**
 * Thrown by the global ValidationPipe's exception factory when a DTO fails
 * shape validation. Maps onto the ADR §5 envelope as `VALIDATION_FAILED` (400)
 * with a machine-usable `details` array (docs 05 §3.2), instead of the raw
 * string list the default pipe produces.
 */
export class ValidationFailedException extends AppException {
  constructor(details: ValidationErrorDetail[]) {
    super(
      ERROR_CODES.VALIDATION_FAILED,
      'Request validation failed',
      HttpStatus.BAD_REQUEST,
      details,
    );
  }
}
