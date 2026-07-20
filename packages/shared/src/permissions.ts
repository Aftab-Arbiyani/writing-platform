/**
 * Permission catalogue (PBAC) — the authorization vocabulary. Roles are
 * collections of these permission codes; guards check permissions, never roles.
 * Backend seeds the catalogue + role mappings, resolves a request's effective
 * permissions from its JWT `role` claim (so existing tokens keep working), and
 * frontends can reason about capabilities from the same source.
 *
 * Format: `module.action`, SCREAMING mapped to lowercase dotted codes. Grants
 * may use wildcards (`module.*`, `*`) — those are NOT catalogue entries, only
 * grant shortcuts (see `DEFAULT_ROLE_PERMISSIONS` + the guard's matcher).
 */
import { Role } from './enums.js';

/** The wildcard grant that matches every permission (super-admin). */
export const WILDCARD_PERMISSION = '*';

/** Named permission codes — one const per concrete capability. */
export const PERMISSIONS = {
  // user
  UserView: 'user.view',
  UserUpdate: 'user.update',
  UserSuspend: 'user.suspend',
  UserRestore: 'user.restore',
  // profile
  ProfileUpdate: 'profile.update',
  ProfileManage: 'profile.manage',
  // piece
  PieceCreate: 'piece.create',
  PieceUpdate: 'piece.update',
  PiecePublish: 'piece.publish',
  PieceArchive: 'piece.archive',
  PieceDelete: 'piece.delete',
  PieceFeature: 'piece.feature',
  // comment
  CommentCreate: 'comment.create',
  CommentDelete: 'comment.delete',
  CommentLock: 'comment.lock',
  // engagement
  ClapCreate: 'clap.create',
  BookmarkManage: 'bookmark.manage',
  CollectionManage: 'collection.manage',
  // moderation
  ReportReview: 'report.review',
  ReportResolve: 'report.resolve',
  // platform
  NotificationManage: 'notification.manage',
  SettingsManage: 'settings.manage',
  AnalyticsView: 'analytics.view',
  TaxonomyManage: 'taxonomy.manage',
  AdminDashboard: 'admin.dashboard',
  SystemManage: 'system.manage',
  // ai (AF1) — `ai.use` invokes AI features + manages own overrides;
  // `ai.manage` administers providers/models/prompts/org-defaults/usage.
  AiUse: 'ai.use',
  AiManage: 'ai.manage',
  // monetization (AF5) — `billing.use` manages one's own subscription/purchases/
  // credits; `billing.manage` administers plans/pricing/promotions/coupons/
  // entitlement overrides/refunds and views revenue/usage/AI-cost analytics.
  BillingUse: 'billing.use',
  BillingManage: 'billing.manage',
} as const;

/** Union of every concrete permission code. */
export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** One catalogue row — persisted to the `permissions` table by the seeder. */
export interface PermissionDefinition {
  readonly code: PermissionCode;
  readonly name: string;
  readonly module: string;
  readonly description: string;
}

/** The full catalogue (concrete permissions only — never wildcards). */
export const PERMISSION_CATALOGUE: readonly PermissionDefinition[] = [
  {
    code: PERMISSIONS.UserView,
    name: 'View users',
    module: 'user',
    description: 'View user accounts.',
  },
  {
    code: PERMISSIONS.UserUpdate,
    name: 'Update users',
    module: 'user',
    description: 'Edit user accounts.',
  },
  {
    code: PERMISSIONS.UserSuspend,
    name: 'Suspend users',
    module: 'user',
    description: 'Suspend a user account.',
  },
  {
    code: PERMISSIONS.UserRestore,
    name: 'Restore users',
    module: 'user',
    description: 'Restore a suspended account.',
  },
  {
    code: PERMISSIONS.ProfileUpdate,
    name: 'Update own profile',
    module: 'profile',
    description: 'Edit your own profile.',
  },
  {
    code: PERMISSIONS.ProfileManage,
    name: 'Manage profiles',
    module: 'profile',
    description: 'Manage any profile.',
  },
  {
    code: PERMISSIONS.PieceCreate,
    name: 'Create pieces',
    module: 'piece',
    description: 'Create a draft piece.',
  },
  {
    code: PERMISSIONS.PieceUpdate,
    name: 'Update pieces',
    module: 'piece',
    description: 'Edit a piece.',
  },
  {
    code: PERMISSIONS.PiecePublish,
    name: 'Publish pieces',
    module: 'piece',
    description: 'Publish / schedule a piece.',
  },
  {
    code: PERMISSIONS.PieceArchive,
    name: 'Archive pieces',
    module: 'piece',
    description: 'Archive a piece.',
  },
  {
    code: PERMISSIONS.PieceDelete,
    name: 'Delete pieces',
    module: 'piece',
    description: 'Delete a piece.',
  },
  {
    code: PERMISSIONS.PieceFeature,
    name: 'Feature pieces',
    module: 'piece',
    description: 'Feature/curate a piece.',
  },
  {
    code: PERMISSIONS.CommentCreate,
    name: 'Create comments',
    module: 'comment',
    description: 'Post comments and replies.',
  },
  {
    code: PERMISSIONS.CommentDelete,
    name: 'Delete comments',
    module: 'comment',
    description: 'Delete any comment.',
  },
  {
    code: PERMISSIONS.CommentLock,
    name: 'Lock comments',
    module: 'comment',
    description: 'Lock a comment thread.',
  },
  { code: PERMISSIONS.ClapCreate, name: 'Clap', module: 'clap', description: 'Clap on pieces.' },
  {
    code: PERMISSIONS.BookmarkManage,
    name: 'Manage bookmarks',
    module: 'bookmark',
    description: 'Manage your bookmarks.',
  },
  {
    code: PERMISSIONS.CollectionManage,
    name: 'Manage collections',
    module: 'collection',
    description: 'Manage your collections.',
  },
  {
    code: PERMISSIONS.ReportReview,
    name: 'Review reports',
    module: 'report',
    description: 'Review moderation reports.',
  },
  {
    code: PERMISSIONS.ReportResolve,
    name: 'Resolve reports',
    module: 'report',
    description: 'Resolve moderation reports.',
  },
  {
    code: PERMISSIONS.NotificationManage,
    name: 'Manage notifications',
    module: 'notification',
    description: 'Manage/broadcast system notifications.',
  },
  {
    code: PERMISSIONS.SettingsManage,
    name: 'Manage settings',
    module: 'settings',
    description: 'Manage platform settings.',
  },
  {
    code: PERMISSIONS.AnalyticsView,
    name: 'View analytics',
    module: 'analytics',
    description: 'View analytics dashboards.',
  },
  {
    code: PERMISSIONS.TaxonomyManage,
    name: 'Manage taxonomy',
    module: 'taxonomy',
    description: 'Manage languages/genres/tags.',
  },
  {
    code: PERMISSIONS.AdminDashboard,
    name: 'Access admin dashboard',
    module: 'admin',
    description: 'Access the admin dashboard.',
  },
  {
    code: PERMISSIONS.SystemManage,
    name: 'Manage system',
    module: 'system',
    description: 'Full system administration.',
  },
  {
    code: PERMISSIONS.AiUse,
    name: 'Use AI',
    module: 'ai',
    description: 'Invoke AI features and manage your own AI settings.',
  },
  {
    code: PERMISSIONS.AiManage,
    name: 'Manage AI platform',
    module: 'ai',
    description: 'Administer AI providers, models, prompts, defaults, and usage.',
  },
  {
    code: PERMISSIONS.BillingUse,
    name: 'Use billing',
    module: 'billing',
    description: 'Manage your own subscription, purchases, credits, and payment methods.',
  },
  {
    code: PERMISSIONS.BillingManage,
    name: 'Manage monetization',
    module: 'billing',
    description:
      'Administer plans, pricing, promotions, coupons, entitlement overrides, refunds, and revenue/usage analytics.',
  },
];

/**
 * Default permission grants per role — the seed for `role_permissions`. These are
 * INCREMENTAL: a role's *effective* permissions are the union of its own grants
 * plus every lower-ranked role's (rank inheritance, preserving RBAC semantics so
 * a moderator/admin keeps a user's capabilities — backward compatibility). Grants
 * may be wildcards; `super_admin` gets `*`.
 *
 * `notification.manage` is granted to `admin` (beyond the illustrative brief list)
 * so admins retain the system-notification management they had under RBAC.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, readonly string[]> = {
  [Role.SuperAdmin]: [WILDCARD_PERMISSION],
  [Role.Admin]: [
    'user.*',
    'profile.*',
    'piece.*',
    'comment.*',
    'report.*',
    'settings.*',
    'taxonomy.*',
    'ai.*',
    'billing.*',
    'notification.manage',
    PERMISSIONS.AnalyticsView,
    PERMISSIONS.AdminDashboard,
  ],
  [Role.Moderator]: [
    PERMISSIONS.ReportReview,
    PERMISSIONS.ReportResolve,
    PERMISSIONS.PieceArchive,
    PERMISSIONS.PieceFeature,
    PERMISSIONS.CommentDelete,
    PERMISSIONS.CommentLock,
  ],
  [Role.User]: [
    PERMISSIONS.ProfileUpdate,
    PERMISSIONS.PieceCreate,
    PERMISSIONS.PieceUpdate,
    PERMISSIONS.PiecePublish,
    PERMISSIONS.PieceArchive,
    PERMISSIONS.PieceDelete,
    PERMISSIONS.CommentCreate,
    PERMISSIONS.ClapCreate,
    PERMISSIONS.BookmarkManage,
    PERMISSIONS.CollectionManage,
    PERMISSIONS.AiUse,
    PERMISSIONS.BillingUse,
  ],
};

/**
 * Whether a set of granted codes satisfies a required code, honoring wildcards:
 * `*` matches anything; `a.*` matches `a.x`, `a.x.y`; exact matches exact. Pure —
 * shared so backend guard and any client-side gating agree.
 */
export function permissionSatisfies(granted: ReadonlySet<string>, required: string): boolean {
  if (granted.has(WILDCARD_PERMISSION) || granted.has(required)) {
    return true;
  }
  const parts = required.split('.');
  for (let i = parts.length - 1; i >= 1; i--) {
    if (granted.has(`${parts.slice(0, i).join('.')}.*`)) {
      return true;
    }
  }
  return false;
}
