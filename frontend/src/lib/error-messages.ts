import { ERROR_CODES } from '@qalam/shared';

/**
 * The single error-copy catalogue (docs/06 §4.5). Clients map `error.code` → localized,
 * literary copy here — server `message` strings are for developers and may change.
 * Unknown codes fall back to a calm, reassuring line. Keyed by the stable code STRING so
 * client-minted transport codes (API_OFFLINE, …) live alongside server ERROR_CODES.
 */
const MESSAGES: Record<string, string> = {
  // Auth
  [ERROR_CODES.AUTH_INVALID_CREDENTIALS]: "That email and password don't match.",
  [ERROR_CODES.AUTH_TOKEN_EXPIRED]: 'Your session expired — please sign in again.',
  [ERROR_CODES.AUTH_SESSION_REVOKED]: 'This session was signed out.',
  [ERROR_CODES.AUTH_EMAIL_UNVERIFIED]: 'Please verify your email to continue.',
  [ERROR_CODES.AUTH_ACCOUNT_SUSPENDED]: 'This account has been suspended.',
  [ERROR_CODES.AUTH_PERMISSION_DENIED]: "You don't have permission to do that.",

  // Cross-cutting
  [ERROR_CODES.RATE_LIMITED]: "You're going a little fast — try again in a moment.",
  [ERROR_CODES.VALIDATION_FAILED]: 'Please check the highlighted fields.',
  [ERROR_CODES.UNAUTHORIZED]: 'Please sign in to continue.',
  [ERROR_CODES.FORBIDDEN]: "You don't have access to that.",
  [ERROR_CODES.NOT_FOUND]: "We couldn't find that.",
  [ERROR_CODES.CONFLICT]: 'That conflicts with something that already exists.',
  [ERROR_CODES.INTERNAL_SERVER_ERROR]: 'Something went wrong on our side. Your work is safe.',

  // Transport (client-minted by the api-client)
  API_OFFLINE: "You're offline — reconnecting…",
  API_TIMEOUT: 'That took too long. Please try again.',
  API_NETWORK_ERROR: "We couldn't reach the server. Check your connection.",
  API_MALFORMED_RESPONSE: 'Something went wrong on our side. Your work is safe.',
  API_UNEXPECTED_ERROR: 'Something went wrong on our side. Your work is safe.',
};

const FALLBACK = 'Something went wrong on our side. Your work is safe.';

/** Map an error code to user-facing copy; unknown codes get the calm fallback. */
export function messageFor(code: string | undefined): string {
  return (code ? MESSAGES[code] : undefined) ?? FALLBACK;
}
