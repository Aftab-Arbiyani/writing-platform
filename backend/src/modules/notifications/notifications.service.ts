import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  NOTIFICATION_UNREAD_DISPLAY_CAP,
  NotificationEntityType,
  NotificationType,
} from '@qalam/shared';

import { JOB_ENQUEUER, type JobEnqueuer } from '../../common/queue/job-enqueuer.port';
import { JOB } from '../../common/queue/queue.constants';
import { buildCursorPage } from '../../common/pagination/pagination.helper';
import type { CursorPage } from '../../common/types/paginated-result';
import type { NotificationQueryDto } from './dto/notification-query.dto';
import type {
  NotificationPreferencesDto,
  UpdateNotificationPreferencesDto,
} from './dto/notification-preferences.dto';
import type { NotificationDto, UnreadCountDto } from './dto/notification-response.dto';
import type {
  CreateSystemNotificationDto,
  SystemNotificationDto,
} from './dto/system-notification.dto';
import type { NotificationPreference } from './entities/notification-preference.entity';
import type { SystemNotification } from './entities/system-notification.entity';
import {
  notificationCursorKey,
  toNotificationDto,
  toPreferencesDto,
  toSystemNotificationDto,
} from './notification.mappers';
import { chunk, parseNotificationCursor } from './notification.util';
import { NotificationPreferencesRepository } from './notification-preferences.repository';
import {
  NotificationNotFoundException,
  SystemNotificationNotFoundException,
} from './notifications.exceptions';
import { NotificationsCacheService } from './notifications-cache.service';
import {
  BROADCAST_CHUNK_SIZE,
  TYPE_PREFERENCE,
  type PreferenceKey,
} from './notifications.constants';
import type { NewNotification } from './notifications.repository';
import { NotificationsRepository } from './notifications.repository';
import { SystemNotificationsRepository } from './system-notifications.repository';

/**
 * Input to the ONE creation entry point. Modules never insert notifications
 * directly — a listener translates a domain event into this and calls `create()`.
 */
export interface CreateNotificationInput {
  recipientId: string;
  actorId?: string | null;
  type: NotificationType;
  entityType?: NotificationEntityType | null;
  entityId?: string | null;
  data?: Record<string, unknown>;
  /** Collapse reaction/follow storms to one active notification per target. */
  dedupe?: boolean;
}

/**
 * The centralized notification engine (E9). `create()` is the single write path:
 * it drops self-notifications, honors the recipient's preferences, optionally
 * de-duplicates, persists, and invalidates the unread-count cache. Read/mutation
 * operations are all recipient-scoped (a user only ever touches their own inbox).
 * System broadcasts fan out one row per eligible recipient so the same machinery
 * serves them.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly notifications: NotificationsRepository,
    private readonly preferences: NotificationPreferencesRepository,
    private readonly systemNotifications: SystemNotificationsRepository,
    private readonly cache: NotificationsCacheService,
    // Optional: when the queue is wired, broadcasts fan out asynchronously; unit
    // tests construct without it and fall back to synchronous fan-out.
    @Optional() @Inject(JOB_ENQUEUER) private readonly jobs?: JobEnqueuer,
  ) {}

  // ── Creation (the single write path) ──────────────────────────────────────

  /** Creates one notification, or returns null if it was suppressed (self/pref/dup). */
  async create(input: CreateNotificationInput): Promise<void> {
    const actorId = input.actorId ?? null;
    const entityId = input.entityId ?? null;

    // Never notify yourself of your own action.
    if (actorId !== null && actorId === input.recipientId) {
      return;
    }
    // Respect the recipient's category preference.
    if (!(await this.isAllowed(input.recipientId, TYPE_PREFERENCE[input.type]))) {
      return;
    }
    // Storm control: one active notification per (recipient, actor, type, target).
    if (
      input.dedupe === true &&
      (await this.notifications.findActiveDuplicate(
        input.recipientId,
        actorId,
        input.type,
        entityId,
      ))
    ) {
      return;
    }

    await this.notifications.create({
      recipientId: input.recipientId,
      actorId,
      type: input.type,
      entityType: input.entityType ?? null,
      entityId,
      data: input.data ?? {},
    });
    await this.cache.invalidate(input.recipientId);
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  async list(userId: string, query: NotificationQueryDto): Promise<CursorPage<NotificationDto>> {
    const cursor = parseNotificationCursor(query.cursor);
    const rows = await this.notifications.list(
      userId,
      { status: query.status, type: query.type },
      cursor,
      query.limit,
    );
    const page = buildCursorPage(rows, query.limit, notificationCursorKey);
    return { items: page.items.map(toNotificationDto), meta: page.meta };
  }

  async unreadCount(userId: string): Promise<UnreadCountDto> {
    const count = await this.cache.getUnreadCount(userId, () =>
      this.notifications.countUnread(userId),
    );
    return { count, capped: count > NOTIFICATION_UNREAD_DISPLAY_CAP };
  }

  // ── Mutations (recipient-scoped) ────────────────────────────────────────────

  async markRead(userId: string, id: string): Promise<void> {
    const notification = await this.notifications.findOwned(userId, id);
    if (notification === null) {
      throw new NotificationNotFoundException();
    }
    await this.notifications.markRead(notification);
    await this.cache.invalidate(userId);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notifications.markAllRead(userId);
    await this.cache.invalidate(userId);
  }

  async archive(userId: string, id: string): Promise<void> {
    const notification = await this.notifications.findOwned(userId, id);
    if (notification === null) {
      throw new NotificationNotFoundException();
    }
    await this.notifications.archive(notification);
    await this.cache.invalidate(userId);
  }

  async remove(userId: string, id: string): Promise<void> {
    const notification = await this.notifications.findOwned(userId, id);
    if (notification === null) {
      throw new NotificationNotFoundException();
    }
    await this.notifications.softDelete(notification);
    await this.cache.invalidate(userId);
  }

  // ── Preferences ──────────────────────────────────────────────────────────

  async getPreferences(userId: string): Promise<NotificationPreferencesDto> {
    return toPreferencesDto(await this.preferences.find(userId));
  }

  async updatePreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferencesDto> {
    const patch: Partial<NotificationPreference> = {};
    for (const key of [
      'follow',
      'comment',
      'reply',
      'reaction',
      'mention',
      'response',
      'system',
    ] as const) {
      if (dto[key] !== undefined) {
        patch[key] = dto[key];
      }
    }
    return toPreferencesDto(await this.preferences.upsert(userId, patch));
  }

  // ── System broadcasts (admin) ───────────────────────────────────────────────

  async createSystemNotification(
    adminId: string,
    dto: CreateSystemNotificationDto,
  ): Promise<SystemNotificationDto> {
    const record = await this.systemNotifications.create({
      title: dto.title,
      body: dto.body,
      data: dto.data ?? {},
      createdBy: adminId,
      audience: 'all',
    });

    // Fan-out is unbounded (one row per user — docs 02 §5.2). When the queue is
    // wired, hand it to the `notifications` worker so a 50k-recipient broadcast
    // never blocks this request; otherwise fan out inline (tests / no-queue).
    if (this.jobs !== undefined) {
      await this.jobs.enqueue(JOB.Broadcast, { recordId: record.id });
      const eligible = await this.notifications.countBroadcastRecipients();
      return toSystemNotificationDto(record, eligible);
    }
    const delivered = await this.fanOut(record);
    return toSystemNotificationDto(record, delivered);
  }

  /**
   * Loads a system notification by id and fans it out — the `notifications`
   * worker entry point (it only carries the record id). A missing record
   * (deleted between enqueue and processing) is a safe no-op. The synchronous
   * path calls {@link fanOut} directly with the record already in hand.
   */
  async fanOutSystemNotification(recordId: string): Promise<number> {
    const record = await this.systemNotifications.findById(recordId);
    return record === null ? 0 : this.fanOut(record);
  }

  /**
   * The single fan-out implementation: one notification row per eligible
   * recipient (chunked), then unread-cache invalidation. Returns rows written.
   */
  private async fanOut(record: SystemNotification): Promise<number> {
    const recipientIds = await this.notifications.broadcastRecipientIds();
    const data: Record<string, unknown> = {
      title: record.title,
      message: record.body,
      systemNotificationId: record.id,
      ...(record.data ?? {}),
    };
    for (const ids of chunk(recipientIds, BROADCAST_CHUNK_SIZE)) {
      const rows: NewNotification[] = ids.map((recipientId) => ({
        recipientId,
        actorId: null,
        type: NotificationType.System,
        entityType: NotificationEntityType.System,
        entityId: record.id,
        data,
      }));
      await this.notifications.createMany(rows);
    }
    await this.cache.invalidateMany(recipientIds);
    return recipientIds.length;
  }

  /**
   * Prunes notifications older than `cutoff` (retention — docs 04 §3.7, pruned
   * after 12 months). Called by the maintenance worker. Returns rows removed.
   */
  pruneOlderThan(cutoff: Date): Promise<number> {
    return this.notifications.deleteOlderThan(cutoff);
  }

  async listSystemNotifications(limit: number): Promise<SystemNotificationDto[]> {
    const rows = await this.systemNotifications.list(limit);
    // deliveredCount is meaningful on the create response; list is a management view.
    return rows.map((row) => toSystemNotificationDto(row, 0));
  }

  async deleteSystemNotification(id: string): Promise<void> {
    const record = await this.systemNotifications.findById(id);
    if (record === null) {
      throw new SystemNotificationNotFoundException();
    }
    await this.systemNotifications.softDelete(record);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async isAllowed(userId: string, key: PreferenceKey): Promise<boolean> {
    const prefs = await this.preferences.find(userId);
    return prefs === null ? true : prefs[key];
  }
}
