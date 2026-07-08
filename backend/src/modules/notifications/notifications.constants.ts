import type { NotificationType } from '@qalam/shared';
import { NotificationType as NType } from '@qalam/shared';

/** Redis (DB 0) keys for the cached unread badge count. */
export const NOTIFICATION_CACHE_KEYS = {
  unreadCount: (userId: string): string => `notif:unread:v1:${userId}`,
} as const;

/**
 * TTL for the unread-count cache. Invalidation is EXPLICIT (deleted on every
 * state change); the TTL is only a safety net against a missed invalidation.
 */
export const NOTIFICATION_CACHE_TTL = {
  unreadCount: 300,
} as const;

/** Chunk size for the admin broadcast fan-out (bounded memory + statement size). */
export const BROADCAST_CHUNK_SIZE = 500;

/**
 * Preference category governing each notification type. `create()` skips a
 * notification whose category is disabled for the recipient (docs: prefs "work").
 * `PreferenceKey` is the boolean column on `notification_preferences`.
 */
export type PreferenceKey =
  'follow' | 'comment' | 'reply' | 'reaction' | 'mention' | 'response' | 'system';

export const TYPE_PREFERENCE: Record<NotificationType, PreferenceKey> = {
  [NType.Follow]: 'follow',
  [NType.FollowRequest]: 'follow',
  [NType.FollowAccepted]: 'follow',
  [NType.CollectionFollow]: 'follow',
  [NType.Comment]: 'comment',
  [NType.CommentReply]: 'reply',
  [NType.Like]: 'reaction',
  [NType.Clap]: 'reaction',
  [NType.Repost]: 'reaction',
  [NType.Mention]: 'mention',
  [NType.Response]: 'response',
  [NType.System]: 'system',
  [NType.Featured]: 'system',
};
