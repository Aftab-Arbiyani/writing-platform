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
