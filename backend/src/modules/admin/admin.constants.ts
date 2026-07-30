/**
 * Admin user-management constants (E12.5). Sort/field whitelists keep dynamic
 * SQL identifiers and response projection to a fixed, safe set (docs 05 §6,
 * docs 13 §6 — no user text ever reaches a column position).
 */

/** Wire sort key → fully-qualified SQL column for the admin grid. */
export const ADMIN_USER_SORT_COLUMNS = {
  createdAt: 'u.created_at',
  updatedAt: 'u.updated_at',
  username: 'u.username',
  email: 'u.email',
  status: 'u.status',
  lastLoginAt: 'u.last_login_at',
  penName: 'p.pen_name',
  followers: 'p.followers_count',
  following: 'p.following_count',
  pieces: 'p.pieces_count',
} as const;

export type AdminUserSortKey = keyof typeof ADMIN_USER_SORT_COLUMNS;

/** Accepted `?sort=` tokens: each key, and its `-`-prefixed descending form. */
export const ADMIN_USER_SORT_TOKENS: string[] = Object.keys(ADMIN_USER_SORT_COLUMNS).flatMap(
  (key) => [key, `-${key}`],
);

/** Default sort when none is supplied — newest accounts first. */
export const ADMIN_USER_DEFAULT_SORT = '-createdAt';

/** Response columns selectable via `?fields=` (unknown tokens are ignored). */
export const ADMIN_USER_LIST_FIELDS: readonly string[] = [
  'id',
  'avatarKey',
  'username',
  'displayName',
  'email',
  'role',
  'status',
  'verified',
  'isPrivate',
  'followers',
  'following',
  'publishedPieces',
  'draftCount',
  'createdAt',
  'lastLoginAt',
  'lastActiveAt',
];

/** Max user ids accepted in one bulk-actions request (processed synchronously). */
export const ADMIN_BULK_MAX = 200;

/** Rows fetched per batch when streaming an export (keyset, no offset drift). */
export const ADMIN_EXPORT_BATCH = 500;

/** Recent-audit entries surfaced in the detail/activity views. */
export const ADMIN_RECENT_ACTIVITY_LIMIT = 20;
