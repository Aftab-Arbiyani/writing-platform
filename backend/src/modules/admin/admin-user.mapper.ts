import type { AdminUserFilters, AdminUserRow, AdminUserSort } from '../users/users.repository';
import {
  ADMIN_USER_DEFAULT_SORT,
  ADMIN_USER_LIST_FIELDS,
  ADMIN_USER_SORT_COLUMNS,
  type AdminUserSortKey,
} from './admin.constants';
import type { AdminUserListQueryDto } from './dto/admin-user-query.dto';
import type { AdminUserListItemDto } from './dto/admin-user-response.dto';

/** Pure mappers between the users read model and the admin wire DTOs. */

const iso = (value: Date | null): string | null => (value === null ? null : value.toISOString());

/** Parses a validated `?sort=` token into a whitelisted column + direction. */
export function parseSort(token: string | undefined): AdminUserSort {
  const raw = token ?? ADMIN_USER_DEFAULT_SORT;
  const direction = raw.startsWith('-') ? 'DESC' : 'ASC';
  const key = (raw.startsWith('-') ? raw.slice(1) : raw) as AdminUserSortKey;
  const column = ADMIN_USER_SORT_COLUMNS[key] ?? ADMIN_USER_SORT_COLUMNS.createdAt;
  return { column, direction };
}

/** Maps a `'true'`/`'false'` query string to a boolean (undefined passes through). */
function toBool(value: string | undefined): boolean | undefined {
  return value === undefined ? undefined : value === 'true';
}

/** Builds the repository filter object from a validated list/export query DTO. */
export function toAdminUserFilters(query: AdminUserListQueryDto): AdminUserFilters {
  return {
    search: query.q,
    role: query.role,
    status: query.status,
    verified: toBool(query.verified),
    isPrivate: query.visibility === undefined ? undefined : query.visibility === 'private',
    hasPublished: toBool(query.hasPublished),
    registeredFrom: query.registeredFrom,
    registeredTo: query.registeredTo,
    lastLoginFrom: query.lastLoginFrom,
    lastLoginTo: query.lastLoginTo,
    includeDeleted: toBool(query.includeDeleted) ?? false,
    sort: parseSort(query.sort),
    page: query.page,
    offset: query.offset,
    limit: query.limit,
  };
}

/** Maps a joined admin row (+ resolved draft count) to the grid item DTO. */
export function toListItem(row: AdminUserRow, draftCount: number): AdminUserListItemDto {
  return {
    id: row.id,
    avatarKey: row.avatarKey,
    username: row.username,
    displayName: row.penName,
    email: row.email,
    role: row.role,
    status: row.status,
    verified: row.emailVerifiedAt !== null,
    isPrivate: row.isPrivate ?? false,
    followers: row.followersCount ?? 0,
    following: row.followingCount ?? 0,
    publishedPieces: row.piecesCount ?? 0,
    draftCount,
    createdAt: row.createdAt.toISOString(),
    lastLoginAt: iso(row.lastLoginAt),
    // No separate activity signal is stored — last login is the honest proxy.
    lastActiveAt: iso(row.lastLoginAt),
    deletedAt: iso(row.deletedAt),
  };
}

/**
 * Applies `?fields=` column selection to a grid item. Unknown/invalid tokens are
 * ignored; `id` is always retained so rows stay addressable. Returns the full
 * item when no valid subset is requested.
 */
export function projectFields(
  item: AdminUserListItemDto,
  fields: string | undefined,
): Partial<AdminUserListItemDto> {
  if (fields === undefined || fields.trim() === '') {
    return item;
  }
  const requested = new Set(
    fields
      .split(',')
      .map((field) => field.trim())
      .filter((field) => ADMIN_USER_LIST_FIELDS.includes(field)),
  );
  if (requested.size === 0) {
    return item;
  }
  requested.add('id');
  const projected: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(item)) {
    if (requested.has(key)) {
      projected[key] = value;
    }
  }
  return projected as Partial<AdminUserListItemDto>;
}

/** Flat, export-friendly row (CSV columns / JSON objects) for a user. */
export function toExportRow(row: AdminUserRow, draftCount: number): Record<string, unknown> {
  return {
    id: row.id,
    username: row.username,
    displayName: row.penName ?? '',
    email: row.email,
    role: row.role,
    status: row.status,
    verified: row.emailVerifiedAt !== null,
    isPrivate: row.isPrivate ?? false,
    followers: row.followersCount ?? 0,
    following: row.followingCount ?? 0,
    publishedPieces: row.piecesCount ?? 0,
    draftCount,
    createdAt: row.createdAt.toISOString(),
    lastLoginAt: row.lastLoginAt === null ? '' : row.lastLoginAt.toISOString(),
    deletedAt: row.deletedAt === null ? '' : row.deletedAt.toISOString(),
  };
}

/** Column order for CSV export (stable header row). */
export const EXPORT_COLUMNS: readonly string[] = [
  'id',
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
  'deletedAt',
];
