import { NotificationStatus } from '@qalam/shared';

import type { CursorPayload } from '../../common/pagination/cursor.util';
import type { NotificationActorDto, NotificationDto } from './dto/notification-response.dto';
import type { NotificationPreferencesDto } from './dto/notification-preferences.dto';
import type { SystemNotificationDto } from './dto/system-notification.dto';
import type { NotificationPreference } from './entities/notification-preference.entity';
import type { Notification } from './entities/notification.entity';
import type { SystemNotification } from './entities/system-notification.entity';

/** Status is derived from the timestamps — never a stored column (docs 16 §1.3). */
export function deriveStatus(n: Notification): NotificationStatus {
  if (n.archivedAt !== null) {
    return NotificationStatus.Archived;
  }
  if (n.readAt !== null) {
    return NotificationStatus.Read;
  }
  return NotificationStatus.Unread;
}

function extractActor(data: Record<string, unknown>): NotificationActorDto | null {
  const actor = data.actor;
  if (actor === null || actor === undefined || typeof actor !== 'object') {
    return null;
  }
  const a = actor as Record<string, unknown>;
  if (typeof a.username !== 'string') {
    return null;
  }
  return {
    username: a.username,
    penName: typeof a.penName === 'string' ? a.penName : null,
    avatarKey: typeof a.avatarKey === 'string' ? a.avatarKey : null,
  };
}

export function toNotificationDto(n: Notification): NotificationDto {
  const data = n.data ?? {};
  return {
    id: n.id,
    type: n.type,
    status: deriveStatus(n),
    actor: extractActor(data),
    entityType: n.entityType,
    entityId: n.entityId,
    data,
    readAt: n.readAt === null ? null : n.readAt.toISOString(),
    archivedAt: n.archivedAt === null ? null : n.archivedAt.toISOString(),
    createdAt: n.createdAt.toISOString(),
  };
}

export function notificationCursorKey(n: Notification): CursorPayload {
  return { k: n.createdAt.toISOString(), id: n.id };
}

/** Resolves preferences, defaulting every category to on when no row exists. */
export function toPreferencesDto(p: NotificationPreference | null): NotificationPreferencesDto {
  return {
    follow: p?.follow ?? true,
    comment: p?.comment ?? true,
    reply: p?.reply ?? true,
    reaction: p?.reaction ?? true,
    mention: p?.mention ?? true,
    response: p?.response ?? true,
    system: p?.system ?? true,
  };
}

export function toSystemNotificationDto(
  s: SystemNotification,
  deliveredCount: number,
): SystemNotificationDto {
  return {
    id: s.id,
    title: s.title,
    body: s.body,
    data: s.data ?? {},
    createdBy: s.createdBy,
    audience: s.audience,
    createdAt: s.createdAt.toISOString(),
    deliveredCount,
  };
}
