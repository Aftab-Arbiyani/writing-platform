import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@qalam/shared';

import { AppException } from '../../common/exceptions/app.exception';

/**
 * Authenticated but lacking a required permission (PBAC). 403 with the missing
 * codes in `details` so clients can explain exactly what's needed. Distinct from
 * the generic `FORBIDDEN` a bare NestJS `ForbiddenException` would emit.
 */
export class PermissionDeniedException extends AppException {
  constructor(missing: readonly string[]) {
    super(
      ERROR_CODES.AUTH_PERMISSION_DENIED,
      `Missing required permission${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}`,
      HttpStatus.FORBIDDEN,
      [...missing],
    );
  }
}
