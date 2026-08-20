/**
 * Maps `@qalam/shared` ERROR_CODES (and the client's own codes) to calm, admin-appropriate
 * messages. Branch on `code`, never the server `message` (docs/32 §2). Unknown codes fall back to a
 * neutral line — never leak a raw code or stack to an operator.
 */
const MESSAGES: Record<string, string> = {
  // Auth — credentials / login
  AUTH_INVALID_CREDENTIALS: 'That email or password is incorrect.',
  AUTH_ACCOUNT_SUSPENDED: 'This account is suspended. Contact an administrator.',
  AUTH_EMAIL_UNVERIFIED: 'This account’s email is not verified.',
  // Auth — session / tokens
  AUTH_TOKEN_EXPIRED: 'Your session expired. Please sign in again.',
  AUTH_TOKEN_INVALID: 'Your session is no longer valid. Please sign in again.',
  AUTH_SESSION_REVOKED: 'This session was ended. Please sign in again.',
  AUTH_REFRESH_REUSED: 'This session was ended for your security. Please sign in again.',
  UNAUTHORIZED: 'Please sign in to continue.',
  // Access
  FORBIDDEN: 'You don’t have permission to do that.',
  AUTH_PERMISSION_DENIED: 'You don’t have permission to do that.',
  // Requests
  NOT_FOUND: 'We couldn’t find what you were looking for.',
  /*
   * Its own entry, not the generic NOT_FOUND (docs/48 §3.22a, §3.19). The admin trust reads and the
   * four admin monetization per-account reads answer this for an id that belongs to nobody, and it is
   * almost always a mistyped UUID — so the message names the cause and the next action. Without it an
   * operator who dropped one character was told the screen was broken, three times over, which is
   * most of the value those 404s were added for.
   */
  USER_NOT_FOUND: 'No account has that ID. Check it on the Users screen.',
  VALIDATION_FAILED: 'Some fields need attention.',
  CONFLICT: 'That change conflicts with the current state. Refresh and try again.',
  RATE_LIMITED: 'Too many attempts. Please wait a moment and try again.',
  // Client-side (api-client)
  API_MALFORMED_RESPONSE: 'The server sent an unexpected response. Please try again.',
  API_UNEXPECTED_STATUS: 'Something went wrong. Please try again.',
};

const FALLBACK = 'Something went wrong. Please try again.';

export function messageFor(code: string | undefined): string {
  if (!code) return FALLBACK;
  return MESSAGES[code] ?? FALLBACK;
}
