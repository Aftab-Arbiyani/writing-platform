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

/**
 * In-app notification kinds (in-app only in Phase 1, ADR §10). Open catalogue —
 * `notifications.type` is a `varchar(40)`, so adding a kind never needs a
 * migration (docs 04 §1.7, §3.7). New kinds land here first.
 */
export const NotificationType = {
  Follow: 'follow',
  FollowRequest: 'follow_request',
  FollowAccepted: 'follow_accepted',
  Comment: 'comment',
  CommentReply: 'comment_reply',
  Like: 'like',
  Clap: 'clap',
  Response: 'response',
  Mention: 'mention',
  Repost: 'repost',
  Featured: 'featured',
  /** Future-ready (collections follow ships later) — reserved so the type is stable. */
  CollectionFollow: 'collection_follow',
  System: 'system',
  // ── Monetization (AF5) — subscription/billing lifecycle notifications. Open
  // catalogue, so these add without a migration; all map to the `system`
  // preference key (see notifications.constants TYPE_PREFERENCE).
  TrialEnding: 'trial_ending',
  SubscriptionRenewed: 'subscription_renewed',
  SubscriptionExpired: 'subscription_expired',
  PaymentFailed: 'payment_failed',
  PaymentReceipt: 'payment_receipt',
  QuotaExceeded: 'quota_exceeded',
  CreditsLow: 'credits_low',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

/**
 * Notification lifecycle state (E9). Derived from timestamps on the row
 * (`read_at`/`archived_at`) — `deleted` is the soft-delete tombstone and is never
 * returned. Used as the `?status=` list filter and the response discriminator.
 */
export const NotificationStatus = {
  Unread: 'unread',
  Read: 'read',
  Archived: 'archived',
} as const;
export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];

/**
 * Polymorphic target of a notification (`notifications.entity_type`, docs 04
 * §3.7). `entity_id` points at a row of this kind; `null` for actor-less/system
 * notifications.
 */
export const NotificationEntityType = {
  Piece: 'piece',
  Comment: 'comment',
  User: 'user',
  Collection: 'collection',
  System: 'system',
  /** Monetization (AF5) — a subscription or invoice a notification links to. */
  Subscription: 'subscription',
  Invoice: 'invoice',
} as const;
export type NotificationEntityType =
  (typeof NotificationEntityType)[keyof typeof NotificationEntityType];

/** Moderation lifecycle of a report (Moderation module). `appealed` = a resolved report whose subject has filed an appeal. */
export const ReportStatus = {
  Pending: 'pending',
  Reviewing: 'reviewing',
  Resolved: 'resolved',
  Dismissed: 'dismissed',
  Appealed: 'appealed',
} as const;
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

/** What a report targets — polymorphic (`reports.entity_type`). A `response` is a piece linked to a parent. */
export const ReportEntityType = {
  Piece: 'piece',
  Comment: 'comment',
  User: 'user',
  Response: 'response',
} as const;
export type ReportEntityType = (typeof ReportEntityType)[keyof typeof ReportEntityType];

/** Why a report was filed (closed catalogue; `other` carries a free-text description). */
export const ReportReason = {
  Spam: 'spam',
  Harassment: 'harassment',
  HateSpeech: 'hate_speech',
  Violence: 'violence',
  SexualContent: 'sexual_content',
  SelfHarm: 'self_harm',
  Misinformation: 'misinformation',
  Copyright: 'copyright',
  Impersonation: 'impersonation',
  Other: 'other',
} as const;
export type ReportReason = (typeof ReportReason)[keyof typeof ReportReason];

/** Triage priority of a report in the queue. */
export const ReportPriority = {
  Low: 'low',
  Normal: 'normal',
  High: 'high',
  Urgent: 'urgent',
} as const;
export type ReportPriority = (typeof ReportPriority)[keyof typeof ReportPriority];

/** Assessed severity of the reported content/behaviour. */
export const ReportSeverity = {
  Low: 'low',
  Medium: 'medium',
  High: 'high',
  Critical: 'critical',
} as const;
export type ReportSeverity = (typeof ReportSeverity)[keyof typeof ReportSeverity];

/** The moderator's decision recorded when a report is resolved. */
export const ReportResolution = {
  NoAction: 'no_action',
  Dismissed: 'dismissed',
  ContentHidden: 'content_hidden',
  ContentRemoved: 'content_removed',
  UserWarned: 'user_warned',
  UserSuspended: 'user_suspended',
  UserBanned: 'user_banned',
} as const;
export type ReportResolution = (typeof ReportResolution)[keyof typeof ReportResolution];

/** Lifecycle of an appeal against a moderation decision. */
export const AppealStatus = {
  Pending: 'pending',
  Approved: 'approved',
  Rejected: 'rejected',
} as const;
export type AppealStatus = (typeof AppealStatus)[keyof typeof AppealStatus];

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

/**
 * Feed sort orders (E6 — Feeds & Discovery). The wire values a client sends as
 * `?sort=`; each maps to a keyset column in the feed query:
 * `latest` → published_at, `trending` → live trending score, `most_clapped` →
 * claps_count, `most_discussed` → comments_count.
 */
export const FeedSort = {
  Latest: 'latest',
  Trending: 'trending',
  MostClapped: 'most_clapped',
  MostDiscussed: 'most_discussed',
} as const;
export type FeedSort = (typeof FeedSort)[keyof typeof FeedSort];

/**
 * Search scope (E8). `GET /search?type=` selects a single group (or `all` for the
 * grouped global preview); autocomplete reuses the content subset. The `all`
 * value is the default for the grouped endpoint.
 */
export const SearchType = {
  All: 'all',
  Pieces: 'pieces',
  Writers: 'writers',
  Tags: 'tags',
  Genres: 'genres',
  Languages: 'languages',
} as const;
export type SearchType = (typeof SearchType)[keyof typeof SearchType];

/**
 * Piece-search ordering (E8). Distinct from `FeedSort` because search adds
 * `relevance` (the default — ts_rank over the FTS vector) which feeds have no
 * notion of, and names the comment sort per the brief (`most_commented`):
 * `latest` → published_at, `trending` → piece_stats.trending_score,
 * `most_clapped` → claps_count, `most_commented` → comments_count.
 */
export const SearchSort = {
  Relevance: 'relevance',
  Latest: 'latest',
  Trending: 'trending',
  MostClapped: 'most_clapped',
  MostCommented: 'most_commented',
} as const;
export type SearchSort = (typeof SearchSort)[keyof typeof SearchSort];

/** `GET /discover/writers?kind=` — which slice of writers to surface (E6). */
export const WriterKind = {
  Featured: 'featured',
  Popular: 'popular',
  New: 'new',
} as const;
export type WriterKind = (typeof WriterKind)[keyof typeof WriterKind];

/** `GET /discover/pieces?kind=` — which slice of pieces to surface (E6). */
export const DiscoverPieceKind = {
  Featured: 'featured',
  Recent: 'recent',
  MostClapped: 'most_clapped',
  MostDiscussed: 'most_discussed',
} as const;
export type DiscoverPieceKind = (typeof DiscoverPieceKind)[keyof typeof DiscoverPieceKind];

/**
 * How a piece was shared — native PG enum `share_channel` (a closed, stable
 * domain, docs 04 §1.7). Phase 1 tracks the share COUNT only; there is no
 * analytics dashboard yet (E7 social scope, ADR §10):
 * - `internal`  — reshared inside Qalam,
 * - `external`  — sent to an external app/social network,
 * - `copy_link` — the canonical URL was copied to the clipboard.
 */
export const ShareChannel = {
  Internal: 'internal',
  External: 'external',
  CopyLink: 'copy_link',
} as const;
export type ShareChannel = (typeof ShareChannel)[keyof typeof ShareChannel];
