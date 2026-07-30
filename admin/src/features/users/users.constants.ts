import { Role, UserStatus } from '@qalam/shared';

/**
 * URL filter keys for the Users grid — passed to `useAdminTable` so pagination +
 * these params live in the URL (shareable, back-button-friendly). `sort` rides
 * here too (a URL param), so the whole query state is one object.
 */
export const USER_FILTER_KEYS = [
  'q',
  'role',
  'status',
  'verified',
  'visibility',
  'hasPublished',
  'registeredFrom',
  'registeredTo',
  'lastLoginFrom',
  'lastLoginTo',
  'includeDeleted',
  'sort',
] as const;

export type UserFilterKey = (typeof USER_FILTER_KEYS)[number];

export const DEFAULT_USER_SORT = '-createdAt';

/** Select options (labels are operator-facing; values are the wire values). */
export const ROLE_OPTIONS = [
  { label: 'User', value: Role.User },
  { label: 'Moderator', value: Role.Moderator },
  { label: 'Admin', value: Role.Admin },
  { label: 'Super admin', value: Role.SuperAdmin },
];

export const STATUS_OPTIONS = [
  { label: 'Active', value: UserStatus.Active },
  { label: 'Suspended', value: UserStatus.Suspended },
  { label: 'Deactivated', value: UserStatus.Deactivated },
];

export const VERIFIED_OPTIONS = [
  { label: 'Verified', value: 'true' },
  { label: 'Unverified', value: 'false' },
];

export const VISIBILITY_OPTIONS = [
  { label: 'Public', value: 'public' },
  { label: 'Private', value: 'private' },
];

export const HAS_PUBLISHED_OPTIONS = [
  { label: 'Has published', value: 'true' },
  { label: 'No published pieces', value: 'false' },
];

/** Human labels for the role tag. */
export const ROLE_LABELS: Record<string, string> = {
  [Role.User]: 'User',
  [Role.Moderator]: 'Moderator',
  [Role.Admin]: 'Admin',
  [Role.SuperAdmin]: 'Super admin',
};

/** One grid column's metadata. `key` doubles as the backend sort token when `sortable`. */
export interface UserColumnMeta {
  key: string;
  label: string;
  sortable: boolean;
  /** Hidden by default (operator can enable via the column menu). */
  defaultHidden?: boolean;
}

/**
 * The grid's columns. `key` is stable (used for visibility toggles + React keys);
 * for sortable columns it is exactly the backend `?sort=` token (docs 05 §6:
 * createdAt, username, email, status, lastLoginAt, penName, followers, following,
 * pieces), so sort capture maps 1:1 with no translation table.
 */
export const USER_COLUMNS: UserColumnMeta[] = [
  { key: 'avatar', label: 'Avatar', sortable: false },
  { key: 'username', label: 'Username', sortable: true },
  { key: 'penName', label: 'Display name', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'role', label: 'Role', sortable: false },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'verified', label: 'Verification', sortable: false },
  { key: 'visibility', label: 'Visibility', sortable: false },
  { key: 'followers', label: 'Followers', sortable: true },
  { key: 'following', label: 'Following', sortable: true },
  { key: 'pieces', label: 'Published', sortable: true },
  { key: 'draftCount', label: 'Drafts', sortable: false },
  { key: 'createdAt', label: 'Created', sortable: true },
  { key: 'lastLoginAt', label: 'Last login', sortable: true },
  { key: 'lastActiveAt', label: 'Last active', sortable: false, defaultHidden: true },
];

/** Columns that cannot be hidden (the grid stays usable). */
export const REQUIRED_COLUMNS = new Set(['username', 'actions']);
