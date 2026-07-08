/**
 * Product limits — the single source of truth for validation constants.
 * Backend DTOs (class-validator), frontend forms (Zod), and Flutter all
 * enforce THESE numbers; never inline a duplicate literal.
 */

/** Medium-style claps: a user may clap a piece up to 50 times (ADR §4). */
export const MAX_CLAPS_PER_USER_PER_PIECE = 50;

/**
 * Engagement limits (E7 — social & curation). Comments are net-new in this epic
 * (docs 04 records the table addition); the rest follow the ADR-locked surface.
 */
export const COMMENT_MIN_LENGTH = 1;
export const COMMENT_MAX_LENGTH = 2000;
/**
 * Maximum reply nesting. A top-level comment has depth 1; each reply is
 * `parent.depth + 1`. A reply whose resulting depth would exceed this is
 * rejected (`COMMENT_DEPTH_EXCEEDED`). So the deepest allowed chain is
 * comment(1) → reply(2) → reply(3).
 */
export const MAX_COMMENT_DEPTH = 3;

/** Collection metadata bounds (docs 04 §3.5). */
export const COLLECTION_NAME_MIN = 1;
export const COLLECTION_NAME_MAX = 150;
export const COLLECTION_DESCRIPTION_MAX = 500;
/** The auto-created default collection every user gets (slug is stable). */
export const DEFAULT_COLLECTION_TITLE = 'Favorites';
export const DEFAULT_COLLECTION_SLUG = 'favorites';

/** Username length bounds — pairs with USERNAME_REGEX in regex.ts. */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

/** Pen name (single display name per user, ADR §4) length bounds. */
export const PEN_NAME_MIN = 1;
export const PEN_NAME_MAX = 50;

/**
 * Password length policy — NIST 800-63B: length over composition rules
 * (docs 13 §3.1). Hashed with Argon2id at rest.
 */
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

export const TITLE_MAX = 200;
export const SUBTITLE_MAX = 300;
export const FEATURED_QUOTE_MAX = 280;
export const TAGS_MAX_PER_PIECE = 5;
export const BIO_MAX = 500;

/** Profile field bounds (docs 04 §3.1). */
export const LOCATION_MAX = 100;
export const WEBSITE_URL_MAX = 255;
export const SOCIAL_LINK_URL_MAX = 255;
export const MAX_SOCIAL_LINKS = 8;
export const MAX_GENRES_PER_PROFILE = 5;

/** Avatar/cover upload caps (docs 13 §7). */
export const AVATAR_IMAGE_MAX_MB = 5;
export const COVER_IMAGE_MAX_MB = 10;
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Pagination guard rails (cursor and offset alike, ADR §5). */
export const PAGE_SIZE_DEFAULT = 20;
export const PAGE_SIZE_MAX = 50;

/**
 * Search & Discovery bounds (E8 — Postgres FTS). Enforced by the search DTOs
 * (class-validator) and mirrored by the frontend search box.
 */
/** Minimum free-text query length; shorter → `SEARCH_QUERY_TOO_SHORT` (docs 05 §3.2). */
export const SEARCH_QUERY_MIN = 2;
/**
 * Hard cap on raw query length before FTS normalization (docs 13 §6 — strip
 * control chars, collapse whitespace, cap at 256). Over-length input is trimmed,
 * never rejected, so a paste never 400s.
 */
export const SEARCH_QUERY_MAX = 256;
/** Autocomplete suggestions are capped at 10 per group (brief §Autocomplete). */
export const AUTOCOMPLETE_LIMIT_DEFAULT = 10;
export const AUTOCOMPLETE_LIMIT_MAX = 10;
/** Per-group result count for the grouped global-search preview (`GET /search`). */
export const GLOBAL_SEARCH_GROUP_SIZE = 5;
/** A user keeps at most this many recent searches; older ones are trimmed. */
export const RECENT_SEARCHES_MAX = 20;
/** Default number of items returned per group in `GET /search/trending`. */
export const TRENDING_SEARCHES_LIMIT = 10;

/**
 * Notifications (E9). The unread badge is displayed capped at "99+"
 * (docs 04 §3.7); the API returns the true count and this cap alongside so the
 * client renders consistently. System-notification (admin broadcast) text bounds.
 */
export const NOTIFICATION_UNREAD_DISPLAY_CAP = 99;
export const SYSTEM_NOTIFICATION_TITLE_MAX = 150;
export const SYSTEM_NOTIFICATION_BODY_MAX = 1000;
