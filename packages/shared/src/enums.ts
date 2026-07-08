/**
 * Domain enums for the Qalam platform.
 *
 * Implemented as `as const` objects + derived union types instead of TS `enum`
 * on purpose:
 * - erasable: they compile to plain objects (TS enums emit IIFE runtime code
 *   and are hostile to `isolatedModules`/erasable-syntax tooling);
 * - tree-shakeable: bundlers can drop unused members;
 * - JSON-safe: the values ARE the exact wire strings the API returns and the
 *   database stores — no numeric-enum surprises across serialization.
 *
 * The identifier is usable as both a value (`PieceStatus.Draft`) and a type
 * (`status: PieceStatus`).
 */

/** Lifecycle of a written piece: draft → (scheduled) → published → archived. */
export const PieceStatus = {
  Draft: 'draft',
  Scheduled: 'scheduled',
  Published: 'published',
  Archived: 'archived',
} as const;
export type PieceStatus = (typeof PieceStatus)[keyof typeof PieceStatus];

/** Who can see a published piece. */
export const Visibility = {
  Public: 'public',
  Unlisted: 'unlisted',
  Private: 'private',
} as const;
export type Visibility = (typeof Visibility)[keyof typeof Visibility];

/** RBAC hierarchy (ADR §8): user < moderator < admin < super_admin. */
export const Role = {
  User: 'user',
  Moderator: 'moderator',
  Admin: 'admin',
  SuperAdmin: 'super_admin',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

/**
 * Role hierarchy ranks (docs 04 §3.8): guards compare ranks, not names, so
 * `admin` satisfies `@Roles(Moderator)`. Kept beside the enum as the single
 * source for the seeded `roles.rank` column.
 */
export const ROLE_RANK: Record<Role, number> = {
  user: 0,
  moderator: 50,
  admin: 80,
  super_admin: 100,
};

/** Account lifecycle — native PG enum `user_status` (docs 04 §1.7, §3.1). */
export const UserStatus = {
  Active: 'active',
  Suspended: 'suspended',
  Deactivated: 'deactivated',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

/**
 * External identity providers — native PG enum `auth_provider` (docs 04 §3.1).
 * Password sign-in is represented by `users.password_hash`, not an identity row.
 * Apple is deferred (Phase 2) but the enum value is reserved (docs 13 §3.4).
 */
export const AuthProvider = {
  Google: 'google',
  Apple: 'apple',
} as const;
export type AuthProvider = (typeof AuthProvider)[keyof typeof AuthProvider];

/** In-app notification kinds (in-app only in Phase 1, ADR §10). */
export const NotificationType = {
  Follow: 'follow',
  FollowRequest: 'follow_request',
  Like: 'like',
  Clap: 'clap',
  Response: 'response',
  Mention: 'mention',
  Repost: 'repost',
  Featured: 'featured',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

/** Moderation lifecycle of a user report. */
export const ReportStatus = {
  Pending: 'pending',
  Reviewing: 'reviewing',
  Resolved: 'resolved',
  Dismissed: 'dismissed',
} as const;
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

/** Content text direction — Urdu is RTL and a day-one requirement (ADR §0). */
export const TextDirection = {
  Ltr: 'ltr',
  Rtl: 'rtl',
} as const;
export type TextDirection = (typeof TextDirection)[keyof typeof TextDirection];

/**
 * Follow-edge state (native PG enum `follow_status`). A `pending` row is a follow
 * request awaiting a private account's approval; `accepted` is an active follow
 * (docs 04 §3.6 — the pending flag added when approved-follows ship, i.e. E2).
 */
export const FollowStatus = {
  Pending: 'pending',
  Accepted: 'accepted',
} as const;
export type FollowStatus = (typeof FollowStatus)[keyof typeof FollowStatus];

/**
 * Server-persisted theme preference (native PG enum `theme_preference`). The
 * client still drives rendering (docs 12); this syncs the choice across devices.
 */
export const ThemePreference = {
  Light: 'light',
  Dark: 'dark',
  System: 'system',
} as const;
export type ThemePreference = (typeof ThemePreference)[keyof typeof ThemePreference];
