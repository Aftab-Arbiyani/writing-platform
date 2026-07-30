import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@qalam/shared';
import type { ErrorCode } from '@qalam/shared';

import { AppException } from '../../common/exceptions/app.exception';

/**
 * Domain exceptions for the Operations Platform (P7.4, docs 16 §3.4). Codes come
 * from the `@qalam/shared` catalogue (never message text). The
 * `AllExceptionsFilter` maps these onto the standard error envelope with the
 * meaningful HTTP status below.
 */
const STATUS_BY_CODE: Partial<Record<ErrorCode, HttpStatus>> = {
  [ERROR_CODES.OPERATIONS_INCIDENT_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ERROR_CODES.OPERATIONS_INVALID_TRANSITION]: HttpStatus.CONFLICT,
  [ERROR_CODES.OPERATIONS_ROLLOUT_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ERROR_CODES.OPERATIONS_INVALID_ROLLOUT]: HttpStatus.UNPROCESSABLE_ENTITY,
};

/** A single operations domain error, mapped to its catalogued HTTP status. */
export class OperationsException extends AppException {
  constructor(code: ErrorCode, message: string) {
    super(code, message, STATUS_BY_CODE[code] ?? HttpStatus.BAD_REQUEST);
  }
}
