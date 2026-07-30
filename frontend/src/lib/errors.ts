import { ApiError } from '@/lib/api-client';
import { messageFor } from '@/lib/error-messages';

/** Narrow to the app's single error type. */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Caller-cancelled fetch (from an AbortController) — never an application error to surface. */
export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** User-facing message for any thrown value: ApiError → code catalogue; else calm fallback. */
export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) return messageFor(error.code);
  return messageFor(undefined);
}

/** The X-Request-Id of a failed request, for the support "Details" disclosure (docs/06 §4.5). */
export function getRequestId(error: unknown): string | undefined {
  return isApiError(error) ? error.requestId : undefined;
}
