import { ApiError } from '@/lib/api-client';
import { messageFor } from '@/lib/error-messages';

/** Narrow to the app's single error type. */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** User-facing message for any thrown value: ApiError → code catalogue; else a calm fallback. */
export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) return messageFor(error.code);
  return messageFor(undefined);
}

/** The X-Request-Id of a failed request, for the error "Details" disclosure (docs/32 §6). */
export function getRequestId(error: unknown): string | undefined {
  return isApiError(error) ? error.requestId : undefined;
}
