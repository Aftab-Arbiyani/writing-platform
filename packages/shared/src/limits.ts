/**
 * Product limits — the single source of truth for validation constants.
 * Backend DTOs (class-validator), frontend forms (Zod), and Flutter all
 * enforce THESE numbers; never inline a duplicate literal.
 */

/** Medium-style claps: a user may clap a piece up to 50 times (ADR §4). */
export const MAX_CLAPS_PER_USER_PER_PIECE = 50;

/** Username length bounds — pairs with USERNAME_REGEX in regex.ts. */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

/** Pen name (single display name per user, ADR §4) length bounds. */
export const PEN_NAME_MIN = 1;
export const PEN_NAME_MAX = 50;

/** Password length policy (hashed with Argon2id at rest, ADR §3). */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export const TITLE_MAX = 200;
export const SUBTITLE_MAX = 300;
export const FEATURED_QUOTE_MAX = 280;
export const TAGS_MAX_PER_PIECE = 5;
export const BIO_MAX = 500;

/** Pagination guard rails (cursor and offset alike, ADR §5). */
export const PAGE_SIZE_DEFAULT = 20;
export const PAGE_SIZE_MAX = 50;

/** Pre-signed upload size validation happens against this (ADR §8). */
export const COVER_IMAGE_MAX_MB = 10;
