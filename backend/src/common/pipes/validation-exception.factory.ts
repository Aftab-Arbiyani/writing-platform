import type { ValidationError } from '@nestjs/common';

import {
  ValidationFailedException,
  type ValidationErrorDetail,
} from '../exceptions/validation-failed.exception';

/**
 * Flattens class-validator's nested `ValidationError` tree into the flat,
 * field-pathed `details` array the API contract requires (docs 05 §3.2).
 *
 * - Nested objects → dotted paths (`profile.penName`).
 * - Array items → bracketed indices (`tags[5]`) — class-validator sets the
 *   child's `property` to the index for array elements.
 * - Each `constraints` entry becomes one detail: key = `rule`, value = message.
 */
export function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): ValidationErrorDetail[] {
  const details: ValidationErrorDetail[] = [];

  for (const error of errors) {
    const isArrayIndex = /^\d+$/.test(error.property);
    const field = isArrayIndex
      ? `${parentPath}[${error.property}]`
      : parentPath === ''
        ? error.property
        : `${parentPath}.${error.property}`;

    if (error.constraints !== undefined) {
      for (const [rule, message] of Object.entries(error.constraints)) {
        details.push({ field, rule, message });
      }
    }

    if (error.children !== undefined && error.children.length > 0) {
      details.push(...flattenValidationErrors(error.children, field));
    }
  }

  return details;
}

/**
 * `exceptionFactory` for the global ValidationPipe (main.ts) — turns validation
 * failures into a `ValidationFailedException` so the exception filter emits the
 * `VALIDATION_FAILED` envelope with structured details.
 */
export function validationExceptionFactory(errors: ValidationError[]): ValidationFailedException {
  return new ValidationFailedException(flattenValidationErrors(errors));
}
