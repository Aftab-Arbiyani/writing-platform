import type { NotificationStatus, NotificationType } from '@qalam/shared';

/**
 * Notification & activity wire types (E9, docs/32 §10) — mirror the frozen `v1` DTOs
 * (`backend/src/modules/notifications/dto/*`). Replace with generated `@qalam/api-types` once the
 * backend emits `openapi.json`. `avatarKey` is an S3 KEY, never a URL — build via `mediaUrl()`.
 */

/** The actor who triggered a notification (denormalized at emit time; null for system items). */
export interface NotificationActor {
  username: string;
  penName: string | null;
  avatarKey: string | null;
}

/**
 * One inbox item. `status` is server-derived from `readAt`/`archivedAt`. `data` is the
 * denormalized, type-specific render payload — the client reads its fields defensively
 * (`lib/describe-notification`) and never re-fetches the related entity to render a row.
 */
export interface NotificationItem {
  id: string;
  type: NotificationType;
  status: NotificationStatus;
  actor: NotificationActor | null;
  entityType: string | null;
  entityId: string | null;
  data: Record<string, unknown>;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
}

/** `GET /notifications/unread-count` — exact count + a flag for the 99+ display cap. */
export interface UnreadCount {
  count: number;
  capped: boolean;
}

/**
 * The seven preference categories (`GET/PATCH /notification-preferences`). Each gates a set of
 * notification types server-side (`TYPE_PREFERENCE`); a missing row defaults every category on.
 */
export interface NotificationPreferences {
  follow: boolean;
  comment: boolean;
  reply: boolean;
  reaction: boolean;
  mention: boolean;
  response: boolean;
  system: boolean;
}

export type NotificationPreferenceKey = keyof NotificationPreferences;
