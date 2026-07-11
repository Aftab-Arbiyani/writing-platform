import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@qalam/shared';

import { AppException } from '../../common/exceptions/app.exception';

/** Domain exceptions for System Settings (E12.8, docs 16 §3.4). */

/** A referenced setting key is not in the configuration catalogue. */
export class SettingNotFoundException extends AppException {
  constructor(key: string) {
    super(ERROR_CODES.SETTING_NOT_FOUND, `Unknown setting: ${key}.`, HttpStatus.NOT_FOUND);
  }
}

/** An attempt to change an infra-managed (`editable: false`) setting. */
export class SettingNotEditableException extends AppException {
  constructor(key: string) {
    super(
      ERROR_CODES.SETTING_NOT_EDITABLE,
      `Setting ${key} is managed by the environment and cannot be edited.`,
      HttpStatus.FORBIDDEN,
    );
  }
}

/** A setting value failed its data-type / validation-rule check (domain rule → 422). */
export class SettingInvalidValueException extends AppException {
  constructor(key: string, reason: string) {
    super(
      ERROR_CODES.SETTING_INVALID_VALUE,
      `Invalid value for ${key}: ${reason}.`,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

/** A feature-flag id/key does not exist. */
export class FeatureFlagNotFoundException extends AppException {
  constructor() {
    super(ERROR_CODES.FEATURE_FLAG_NOT_FOUND, 'No such feature flag.', HttpStatus.NOT_FOUND);
  }
}

/** Creating a feature flag whose key is already registered (state conflict → 409). */
export class FeatureFlagAlreadyExistsException extends AppException {
  constructor(key: string) {
    super(
      ERROR_CODES.FEATURE_FLAG_ALREADY_EXISTS,
      `A feature flag with key ${key} already exists.`,
      HttpStatus.CONFLICT,
    );
  }
}
