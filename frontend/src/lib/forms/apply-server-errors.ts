import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';

import { ApiError } from '@/lib/api-client';
import { messageFor, messageForRule } from '@/lib/error-messages';

/**
 * Maps a server error envelope onto React Hook Form (docs/33 §4). The single helper every
 * form uses so error placement is consistent:
 *
 * - **Field-level details** (`VALIDATION_FAILED` → `error.details[]`) land inline under the
 *   named field. `d.field` uses dot/bracket paths (`profile.penName`, `tags[5]`, docs/05 §4).
 * - **Code-only errors** (no details — e.g. `AUTH_INVALID_CREDENTIALS`, `USER_USERNAME_TAKEN`)
 *   render as a form-level banner via `errors.root.server`, UNLESS the caller maps the code to
 *   a specific field (e.g. username-taken → the username field).
 *
 * Copy is resolved from `lib/error-messages` by `code`/`rule`, never the server `.message`
 * (developer-facing, may change — docs/05 §3).
 */

/** One field-level validation detail from the `VALIDATION_FAILED` envelope (docs/05 §4). */
interface ValidationDetail {
  field?: string;
  rule?: string;
  message?: string;
}

function isValidationDetail(value: unknown): value is ValidationDetail {
  return typeof value === 'object' && value !== null;
}

export interface ApplyServerErrorsOptions<T extends FieldValues> {
  /**
   * Route specific code-only errors to a field instead of the root banner — e.g.
   * `{ AUTH_EMAIL_TAKEN: 'email', USER_USERNAME_TAKEN: 'username' }`.
   */
  fieldForCode?: Partial<Record<string, Path<T>>>;
}

export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  form: UseFormReturn<T>,
  options: ApplyServerErrorsOptions<T> = {},
): void {
  if (!(error instanceof ApiError)) {
    form.setError('root.server', { type: 'server', message: messageFor('API_UNEXPECTED_ERROR') });
    return;
  }

  const details = error.details.filter(isValidationDetail);

  // 400 VALIDATION_FAILED — place each field detail inline.
  if (details.length > 0) {
    let firstField: Path<T> | undefined;
    for (const detail of details) {
      if (!detail.field) continue;
      const path = detail.field as Path<T>;
      firstField ??= path;
      form.setError(path, { type: 'server', message: messageForRule(detail.rule) });
    }
    if (firstField) form.setFocus(firstField);
    return;
  }

  // Code-only error: route to a field if the caller mapped it, else a form-level banner.
  const mappedField = options.fieldForCode?.[error.code];
  if (mappedField) {
    form.setError(mappedField, { type: 'server', message: messageFor(error.code) });
    form.setFocus(mappedField);
    return;
  }

  form.setError('root.server', { type: 'server', message: messageFor(error.code) });
}
