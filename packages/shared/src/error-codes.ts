/**
 * Error-code catalogue — the `error.code` half of the API envelope (ADR §5).
 *
 * Convention: `DOMAIN_REASON`, stable forever once shipped (clients and the
 * Flutter app switch on these strings). HTTP status codes remain meaningful;
 * these codes disambiguate WITHIN a status (e.g. two different 409s).
 * Key === value so the object doubles as a lookup table and a namespace.
 */
export const ERROR_CODES = {
  // ── Auth ────────────────────────────────────────────────────────────────
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  /** Rotating-refresh reuse detected — the whole token family is revoked (docs 13 §3.2). */
  AUTH_REFRESH_REUSED: 'AUTH_REFRESH_REUSED',
  /** Session invalidated by "log out everywhere" (session-version bump, docs 13 §3.6). */
  AUTH_SESSION_REVOKED: 'AUTH_SESSION_REVOKED',
  AUTH_EMAIL_TAKEN: 'AUTH_EMAIL_TAKEN',
  /** Action requires a verified email (VerifiedUserGuard, docs 05 §3). */
  AUTH_EMAIL_UNVERIFIED: 'AUTH_EMAIL_UNVERIFIED',
  /** Verification token missing / expired / already used. */
  AUTH_VERIFICATION_INVALID: 'AUTH_VERIFICATION_INVALID',
  /** Resend/verify attempted on an already-verified account. */
  AUTH_EMAIL_ALREADY_VERIFIED: 'AUTH_EMAIL_ALREADY_VERIFIED',
  /** Password-reset token missing / expired / already used. */
  AUTH_RESET_INVALID: 'AUTH_RESET_INVALID',
  /** Password fails policy (length or breached-list, docs 13 §3.1). */
  AUTH_PASSWORD_WEAK: 'AUTH_PASSWORD_WEAK',
  /** Change-password: supplied current password did not match. */
  AUTH_CURRENT_PASSWORD_INVALID: 'AUTH_CURRENT_PASSWORD_INVALID',
  AUTH_OAUTH_FAILED: 'AUTH_OAUTH_FAILED',
  /** OAuth `state` mismatch / expired (CSRF nonce, docs 13 §3.4). */
  AUTH_OAUTH_STATE_INVALID: 'AUTH_OAUTH_STATE_INVALID',
  AUTH_ACCOUNT_SUSPENDED: 'AUTH_ACCOUNT_SUSPENDED',

  // ── Users / profiles ────────────────────────────────────────────────────
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_USERNAME_TAKEN: 'USER_USERNAME_TAKEN',
  /** Usernames are permanent after creation (ADR §4 identity rules). */
  USER_USERNAME_IMMUTABLE: 'USER_USERNAME_IMMUTABLE',
  USER_PRIVATE_ACCOUNT: 'USER_PRIVATE_ACCOUNT',
  USER_CANNOT_FOLLOW_SELF: 'USER_CANNOT_FOLLOW_SELF',
  /** Editing a profile that isn't yours. */
  PROFILE_FORBIDDEN: 'PROFILE_FORBIDDEN',
  /** Selected language is unknown or inactive (taxonomy). */
  LANGUAGE_INVALID: 'LANGUAGE_INVALID',
  /** One or more selected genres are unknown or inactive (taxonomy). */
  GENRE_INVALID: 'GENRE_INVALID',

  // ── Follow graph ──────────────────────────────────────────────────────────
  FOLLOW_ALREADY_EXISTS: 'FOLLOW_ALREADY_EXISTS',
  FOLLOW_REQUEST_PENDING: 'FOLLOW_REQUEST_PENDING',
  FOLLOW_NOT_FOUND: 'FOLLOW_NOT_FOUND',
  FOLLOW_REQUEST_NOT_FOUND: 'FOLLOW_REQUEST_NOT_FOUND',

  // ── Pieces (writing lifecycle) ────────────────────────────────────────────
  PIECE_NOT_FOUND: 'PIECE_NOT_FOUND',
  /** Editing/deleting/publishing a piece that isn't yours. */
  PIECE_FORBIDDEN: 'PIECE_FORBIDDEN',
  PIECE_SCHEDULE_IN_PAST: 'PIECE_SCHEDULE_IN_PAST',
  PIECE_ALREADY_PUBLISHED: 'PIECE_ALREADY_PUBLISHED',
  PIECE_NOT_PUBLISHED: 'PIECE_NOT_PUBLISHED',
  /** Illegal lifecycle transition (e.g. archive a draft, publish an archived piece). */
  PIECE_INVALID_TRANSITION: 'PIECE_INVALID_TRANSITION',
  /** Publish/schedule attempted with required fields missing (title/genre/content). */
  PIECE_INCOMPLETE: 'PIECE_INCOMPLETE',
  /** Stored TipTap document failed the server-side schema whitelist (docs 13 §5.2). */
  PIECE_CONTENT_INVALID: 'PIECE_CONTENT_INVALID',
  PIECE_TAG_LIMIT_EXCEEDED: 'PIECE_TAG_LIMIT_EXCEEDED',

  // ── Engagement ──────────────────────────────────────────────────────────
  /** Cap enforced by MAX_CLAPS_PER_USER_PER_PIECE in limits.ts (E7). */
  CLAP_LIMIT_REACHED: 'CLAP_LIMIT_REACHED',
  // Engagement on a draft/scheduled/archived piece reuses PIECE_NOT_PUBLISHED (409).

  // Comments (E7)
  COMMENT_NOT_FOUND: 'COMMENT_NOT_FOUND',
  /** Editing/deleting a comment that isn't yours (delete also allows admins). */
  COMMENT_FORBIDDEN: 'COMMENT_FORBIDDEN',
  /** Reply nesting would exceed MAX_COMMENT_DEPTH. */
  COMMENT_DEPTH_EXCEEDED: 'COMMENT_DEPTH_EXCEEDED',
  /** Replying to a comment that is already soft-deleted. */
  COMMENT_DELETED: 'COMMENT_DELETED',

  // Collections (E7) — private/owner-only: a missing OR foreign collection is
  // COLLECTION_NOT_FOUND (404), never revealing another user's collection exists.
  COLLECTION_NOT_FOUND: 'COLLECTION_NOT_FOUND',
  /** Owner already has a collection with this title/slug. */
  COLLECTION_NAME_TAKEN: 'COLLECTION_NAME_TAKEN',
  /** The piece is already in the collection. */
  COLLECTION_PIECE_EXISTS: 'COLLECTION_PIECE_EXISTS',
  /** The piece is not in the collection (remove target missing). */
  COLLECTION_PIECE_NOT_FOUND: 'COLLECTION_PIECE_NOT_FOUND',
  /** The default "Favorites" collection cannot be renamed or deleted. */
  COLLECTION_DEFAULT_IMMUTABLE: 'COLLECTION_DEFAULT_IMMUTABLE',

  // Responses (E7) — a response is a new piece linked to a parent piece.
  /** A piece cannot respond to itself. */
  RESPONSE_TO_SELF: 'RESPONSE_TO_SELF',
  /** This piece already responds to a parent (one parent per response). */
  RESPONSE_ALREADY_EXISTS: 'RESPONSE_ALREADY_EXISTS',

  // ── Feeds & Discovery (E6) ────────────────────────────────────────────────
  /** A cursor was supplied but failed to decode/verify — client restarts from page 1. */
  FEED_INVALID_CURSOR: 'FEED_INVALID_CURSOR',

  // ── Search & Discovery (E8) ───────────────────────────────────────────────
  /** `q` shorter than SEARCH_QUERY_MIN (2 chars) after normalization (docs 05 §3.2). */
  SEARCH_QUERY_TOO_SHORT: 'SEARCH_QUERY_TOO_SHORT',
  /** FTS backend degraded/unreachable — client retries with backoff (docs 05 §3.2, 503). */
  SEARCH_UNAVAILABLE: 'SEARCH_UNAVAILABLE',
  /** A recent-search row to delete does not exist (or is not the caller's). */
  SEARCH_RECENT_NOT_FOUND: 'SEARCH_RECENT_NOT_FOUND',

  // ── Notifications (E9) ────────────────────────────────────────────────────
  /** No such notification, or it belongs to another user (privacy-preserving 404). */
  NOTIFICATION_NOT_FOUND: 'NOTIFICATION_NOT_FOUND',
  /** Admin system-notification target does not exist. */
  SYSTEM_NOTIFICATION_NOT_FOUND: 'SYSTEM_NOTIFICATION_NOT_FOUND',

  // ── Moderation ──────────────────────────────────────────────────────────
  REPORT_NOT_FOUND: 'REPORT_NOT_FOUND',
  REPORT_ALREADY_RESOLVED: 'REPORT_ALREADY_RESOLVED',

  // ── Media ───────────────────────────────────────────────────────────────
  MEDIA_TYPE_UNSUPPORTED: 'MEDIA_TYPE_UNSUPPORTED',
  MEDIA_TOO_LARGE: 'MEDIA_TOO_LARGE',

  // ── Cross-cutting ───────────────────────────────────────────────────────
  RATE_LIMITED: 'RATE_LIMITED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const;

/** Union of every catalogued error code string. */
export type ErrorCode = keyof typeof ERROR_CODES;
