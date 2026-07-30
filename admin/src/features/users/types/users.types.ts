import type { Role, UserStatus } from '@qalam/shared';

/**
 * Wire types for the Admin User Management feature (A4). These mirror the backend
 * E12.5 response DTOs (`backend/src/modules/admin/dto/*`). They are hand-authored
 * because `@qalam/api-types` has not yet been regenerated for the new `/admin/users*`
 * surface — TODO(aftab): drop these for the generated types once `openapi.json` is
 * re-exported and `@qalam/api-types` picks up the admin tag.
 */

/** One audit-trail entry (backend AuditLogDto). */
export interface AuditLogEntry {
  id: string;
  action: string;
  category: 'status' | 'role' | 'security' | 'administrative' | string;
  actorId: string | null;
  actorRole: string | null;
  targetId: string | null;
  targetType: string;
  metadata: Record<string, unknown>;
  ip: string | null;
  requestId: string | null;
  createdAt: string;
}

/** Aggregate audit summary for a user (backend AuditSummaryDto). */
export interface AuditSummary {
  totalEvents: number;
  byAction: Record<string, number>;
  byCategory: Record<string, number>;
  lastActionAt: string | null;
}

/** A row in the admin user grid (backend AdminUserListItemDto). */
export interface AdminUserListItem {
  id: string;
  avatarKey: string | null;
  username: string;
  displayName: string | null;
  email: string;
  role: Role;
  status: UserStatus;
  verified: boolean;
  isPrivate: boolean;
  followers: number;
  following: number;
  publishedPieces: number;
  draftCount: number;
  createdAt: string;
  lastLoginAt: string | null;
  lastActiveAt: string | null;
  deletedAt: string | null;
}

export interface AdminUserProfile {
  penName: string | null;
  bio: string | null;
  avatarKey: string | null;
  coverKey: string | null;
  websiteUrl: string | null;
  location: string | null;
  socialLinks: Record<string, string>;
}

export interface AdminUserStatistics {
  views: number;
  reads: number;
  followers: number;
  following: number;
  publishedPieces: number;
  drafts: number;
  comments: number;
  bookmarks: number;
  claps: number;
  responses: number;
}

export interface AdminUserModeration {
  currentStatus: UserStatus;
  isVerified: boolean;
  reports: number;
  warnings: number;
  statusChanges: number;
  lastActionAt: string | null;
}

/** Full detail view (backend AdminUserDetailDto). */
export interface AdminUserDetail {
  id: string;
  username: string;
  email: string;
  role: Role;
  status: UserStatus;
  verified: boolean;
  isPrivate: boolean;
  profile: AdminUserProfile;
  statistics: AdminUserStatistics;
  moderation: AdminUserModeration;
  auditSummary: AuditSummary;
  recentActivity: AuditLogEntry[];
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  deletedAt: string | null;
}

export interface LoginEvent {
  at: string;
}

/** Activity view (backend AdminUserActivityDto). */
export interface AdminUserActivity {
  recentLogins: LoginEvent[];
  publishing: Record<string, number>;
  moderationActivity: AuditLogEntry[];
  accountEvents: AuditLogEntry[];
  note: string;
}

/** Login history (backend AdminLoginHistoryDto). */
export interface AdminLoginHistory {
  lastLoginAt: string | null;
  successfulLogins: LoginEvent[];
  failedLogins: LoginEvent[];
  devices: string[];
  ipAddresses: string[];
  note: string;
}

/** Result of a single admin mutation (backend AdminActionResultDto). */
export interface AdminActionResult {
  id: string;
  action: string;
  before: string | null;
  after: string | null;
  message: string;
}

/** Bulk operation outcome (backend BulkActionResultDto). */
export interface BulkActionResult {
  action: string;
  requested: number;
  succeeded: string[];
  failed: Array<{ id: string; code: string; message: string }>;
  data?: Array<Record<string, unknown>>;
}

/** The single-user actions the UI can invoke (map to POST /admin/users/:id/<action>). */
export type UserAction =
  | 'verify'
  | 'suspend'
  | 'unsuspend'
  | 'deactivate'
  | 'reactivate'
  | 'reset-password'
  | 'force-logout';

/** The bulk operations (map to POST /admin/users/bulk-actions `action`). */
export type BulkAction =
  'verify' | 'suspend' | 'activate' | 'deactivate' | 'force_logout' | 'export';

/** PATCH /admin/users/:id body. */
export interface UpdateUserPayload {
  displayName?: string;
  role?: Role;
  status?: UserStatus;
  verified?: boolean;
  reason?: string;
}

/**
 * Validated list/export filters, already string-coerced for the wire (docs 05 §6).
 * A `type` (not `interface`) so it satisfies the api-client's `query:
 * Record<string, QueryValue>` param (interfaces lack an implicit index signature).
 */
export type UserListParams = {
  page?: number;
  limit?: number;
  q?: string;
  // Filter values are strings (URL-sourced; validated server-side). The UI selects
  // constrain them to valid Role/UserStatus/boolean values.
  role?: string;
  status?: string;
  verified?: string;
  visibility?: string;
  hasPublished?: string;
  registeredFrom?: string;
  registeredTo?: string;
  lastLoginFrom?: string;
  lastLoginTo?: string;
  includeDeleted?: string;
  sort?: string;
  fields?: string;
};
