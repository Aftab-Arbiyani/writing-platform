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

  // Profiles & follows (F5)
  [ERROR_CODES.USER_NOT_FOUND]: "We couldn't find that writer.",
  [ERROR_CODES.USER_PRIVATE_ACCOUNT]: 'This writer keeps a private notebook.',
  [ERROR_CODES.USER_CANNOT_FOLLOW_SELF]: 'You cannot follow yourself.',
  [ERROR_CODES.USER_USERNAME_IMMUTABLE]: 'Usernames are permanent and cannot be changed.',
  [ERROR_CODES.PROFILE_FORBIDDEN]: 'You can only edit your own profile.',
  [ERROR_CODES.LANGUAGE_INVALID]: 'Please choose a language from the list.',
  [ERROR_CODES.GENRE_INVALID]: 'Please choose genres from the list.',
  [ERROR_CODES.FOLLOW_ALREADY_EXISTS]: 'You already follow this writer.',
  [ERROR_CODES.FOLLOW_REQUEST_PENDING]: 'Your follow request is still pending.',
  [ERROR_CODES.FOLLOW_NOT_FOUND]: "You aren't following this writer.",
  [ERROR_CODES.FOLLOW_REQUEST_NOT_FOUND]: 'That follow request is no longer available.',

  // Media (avatar/cover uploads)
  [ERROR_CODES.MEDIA_TYPE_UNSUPPORTED]: 'Use a JPEG, PNG, or WebP image.',
  [ERROR_CODES.MEDIA_TOO_LARGE]: 'That image is too large.',

  // Monetization (AF5, W4). Only the codes a *user-facing* client can actually receive — the
  // admin-only coupon/override/webhook codes belong to the admin app, not here.
  //
  // Two of these are states rather than failures, and their copy says so: MONETIZATION_DISABLED is
  // the platform being dark (the default), and PAYMENT_PROVIDER_NOT_CONFIGURED is a deployment
  // without payment credentials. Neither is the reader's fault and neither is worth an alarm.
  [ERROR_CODES.MONETIZATION_DISABLED]: 'Plans and payments aren’t available yet.',
  [ERROR_CODES.PAYMENT_PROVIDER_NOT_CONFIGURED]:
    'Payments aren’t set up on this instance yet, so a plan can’t be purchased here.',
  [ERROR_CODES.PAYMENT_PROVIDER_ERROR]:
    'The payment provider had a problem. Nothing was charged — please try again.',
  [ERROR_CODES.PAYMENT_FAILED]: 'That payment didn’t go through. Please try another method.',
  [ERROR_CODES.SUBSCRIPTION_NOT_FOUND]: 'You don’t have a subscription yet.',
  [ERROR_CODES.SUBSCRIPTION_ALREADY_ACTIVE]: 'You already have an active subscription.',
  [ERROR_CODES.SUBSCRIPTION_INVALID_TRANSITION]: 'That change isn’t possible right now.',
  [ERROR_CODES.PLAN_NOT_FOUND]: 'We couldn’t find that plan.',
  [ERROR_CODES.PLAN_CHANGE_NOOP]: 'You’re already on that plan.',
  [ERROR_CODES.TRIAL_NOT_ELIGIBLE]: 'You’ve already used your free trial.',
  [ERROR_CODES.ENTITLEMENT_DENIED]: 'That feature needs a paid plan.',
  [ERROR_CODES.QUOTA_EXCEEDED]: 'You’ve used your allowance for now. It resets next period.',
  // Sits next to QUOTA_EXCEEDED and says the opposite thing about time on purpose (B4, docs/45
  // §4.9): that one resets, this one never does. Offering "it resets next period" to an author at
  // their piece cap is the W4 remedy-conflation defect (docs/48 §3.6).
  [ERROR_CODES.PIECE_LIMIT_REACHED]:
    'You’ve used all the pieces your plan includes. Delete one to free a slot, or see plans.',
  [ERROR_CODES.INSUFFICIENT_CREDITS]: 'You’re out of AI credits.',
  [ERROR_CODES.RECEIPT_VALIDATION_FAILED]: 'We couldn’t verify that purchase.',
  [ERROR_CODES.PURCHASE_NOT_FOUND]: 'There was nothing to restore.',
  [ERROR_CODES.INVOICE_NOT_FOUND]: 'We couldn’t find that invoice.',
  [ERROR_CODES.PAYMENT_NOT_FOUND]: 'We couldn’t find that payment.',

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
