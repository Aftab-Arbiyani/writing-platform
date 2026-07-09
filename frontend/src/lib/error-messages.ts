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
  [ERROR_CODES.AUTH_TOKEN_INVALID]: 'Your session is no longer valid — please sign in again.',
  [ERROR_CODES.AUTH_REFRESH_REUSED]:
    'Your session ended for security reasons. Please sign in again.',
  [ERROR_CODES.AUTH_SESSION_REVOKED]: 'This session was signed out.',
  [ERROR_CODES.AUTH_EMAIL_UNVERIFIED]: 'Please verify your email to continue.',
  [ERROR_CODES.AUTH_ACCOUNT_SUSPENDED]: 'This account has been suspended.',
  [ERROR_CODES.AUTH_PERMISSION_DENIED]: "You don't have permission to do that.",
  [ERROR_CODES.AUTH_EMAIL_TAKEN]: 'That email is already registered. Try signing in instead.',
  [ERROR_CODES.USER_USERNAME_TAKEN]: 'That username is already taken. Please choose another.',
  [ERROR_CODES.AUTH_VERIFICATION_INVALID]: 'This verification link is invalid or has expired.',
  [ERROR_CODES.AUTH_EMAIL_ALREADY_VERIFIED]: 'Your email is already verified — you can sign in.',
  [ERROR_CODES.AUTH_RESET_INVALID]: 'This password-reset link is invalid or has expired.',
  [ERROR_CODES.AUTH_PASSWORD_WEAK]: 'Please choose a stronger, less common password.',
  [ERROR_CODES.AUTH_CURRENT_PASSWORD_INVALID]: 'Your current password is incorrect.',
  [ERROR_CODES.AUTH_OAUTH_FAILED]: "Google sign-in didn't work. Please try again.",
  [ERROR_CODES.AUTH_OAUTH_STATE_INVALID]: 'Google sign-in timed out. Please try again.',

  // Pieces (writing lifecycle)
  [ERROR_CODES.PIECE_NOT_FOUND]: "We couldn't find that piece.",
  [ERROR_CODES.PIECE_FORBIDDEN]: 'You can only edit your own pieces.',
  [ERROR_CODES.PIECE_SCHEDULE_IN_PAST]: 'That time has already passed.',
  [ERROR_CODES.PIECE_ALREADY_PUBLISHED]: 'This piece is already published.',
  [ERROR_CODES.PIECE_NOT_PUBLISHED]: 'This piece isn’t published.',
  [ERROR_CODES.PIECE_INVALID_TRANSITION]: 'That change isn’t allowed from here.',
  [ERROR_CODES.PIECE_INCOMPLETE]: 'A few things are needed before publishing.',
  [ERROR_CODES.PIECE_CONTENT_INVALID]: 'Some formatting in your piece isn’t supported yet.',
  [ERROR_CODES.PIECE_TAG_LIMIT_EXCEEDED]: 'You can add up to 5 tags.',

  // Media (cover uploads)
  [ERROR_CODES.MEDIA_TYPE_UNSUPPORTED]: 'Use a JPEG, PNG, or WebP image.',
  [ERROR_CODES.MEDIA_TOO_LARGE]: 'That image is too large.',

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

/**
 * Copy for a `VALIDATION_FAILED` field detail, keyed by the class-validator `rule` name
 * (docs/33 §4 — never the server message). Falls back to a calm generic when the rule is
 * unrecognised. The client Zod schema mirrors the backend, so this is defense-in-depth.
 */
const RULE_MESSAGES: Record<string, string> = {
  isEmail: 'Please enter a valid email address.',
  isNotEmpty: 'This field is required.',
  isString: 'This field is required.',
  matches: 'That format isn’t allowed here.',
  minLength: 'This is a little too short.',
  maxLength: 'This is a little too long.',
};

export function messageForRule(rule: string | undefined): string {
  return (rule ? RULE_MESSAGES[rule] : undefined) ?? 'Please check this field.';
}
