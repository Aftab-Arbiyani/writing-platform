import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { NotificationStatus } from '@qalam/shared';
import type { NotificationEntityType, NotificationType } from '@qalam/shared';
import { DataSource, Repository } from 'typeorm';
import type { SelectQueryBuilder } from 'typeorm';

import type { CursorPayload } from '../../common/pagination/cursor.util';
import { Notification } from './entities/notification.entity';

/** A row to create (ids/type/payload already resolved by the service). */
export interface NewNotification {
  recipientId: string;
  actorId: string | null;
  type: NotificationType;
  entityType: NotificationEntityType | null;
  entityId: string | null;
  data: Record<string, unknown>;
}

/** Filters for the inbox list (already validated by the DTO). */
export interface NotificationListFilters {
  status?: NotificationStatus;
  type?: NotificationType;
}

/**
 * Persistence for the `notifications` inbox — the module's own entity, so it uses
 * an injected TypeORM repository (docs 16 §3.3), plus the DataSource for the
 * broadcast recipient scan (a read of the `users`/`notification_preferences`
 * tables by name — no cross-module entity import). Every read/mutation is scoped
 * to the recipient and excludes soft-deleted rows.
 */
@Injectable()
export class NotificationsRepository {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
    private readonly dataSource: DataSource,
  ) {}

  /** Inserts one notification (UUIDv7 assigned by the entity @BeforeInsert). */
  create(row: NewNotification): Promise<Notification> {
    return this.repo.save(this.repo.create(row));
  }

  /** Bulk-inserts a broadcast chunk (each row gets its own UUIDv7). */
  async createMany(rows: NewNotification[]): Promise<void> {
    if (rows.length === 0) {
      return;
    }
    await this.repo.save(rows.map((r) => this.repo.create(r)));
  }

  /**
   * An active (not archived, not deleted) duplicate for the dedup guard — used
   * for reaction/follow storms so a recipient gets one notification per actor per
   * target, not one per clap.
   */
  async findActiveDuplicate(
    recipientId: string,
    actorId: string | null,
    type: NotificationType,
    entityId: string | null,
  ): Promise<boolean> {
    const qb = this.repo
      .createQueryBuilder('n')
      .where('n.recipient_id = :recipientId', { recipientId })
      .andWhere('n.type = :type', { type })
      .andWhere('n.archived_at IS NULL')
      .andWhere('n.deleted_at IS NULL')
      .limit(1);
    qb.andWhere(actorId === null ? 'n.actor_id IS NULL' : 'n.actor_id = :actorId', { actorId });
    qb.andWhere(entityId === null ? 'n.entity_id IS NULL' : 'n.entity_id = :entityId', {
      entityId,
    });
    return (await qb.getCount()) > 0;
  }

  /** The recipient's own notification (any state except deleted), or null. */
  findOwned(recipientId: string, id: string): Promise<Notification | null> {
    return this.repo
      .createQueryBuilder('n')
      .where('n.id = :id', { id })
      .andWhere('n.recipient_id = :recipientId', { recipientId })
      .andWhere('n.deleted_at IS NULL')
      .getOne();
  }

  /** Cursor page of the recipient's inbox (newest first). Over-fetches `limit + 1`. */
  list(
    recipientId: string,
    filters: NotificationListFilters,
    cursor: CursorPayload | null,
    limit: number,
  ): Promise<Notification[]> {
    const qb = this.repo
      .createQueryBuilder('n')
      .where('n.recipient_id = :recipientId', { recipientId })
      .andWhere('n.deleted_at IS NULL')
      .orderBy('n.created_at', 'DESC')
      .addOrderBy('n.id', 'DESC')
      .limit(limit + 1);

    this.applyStatus(qb, filters.status);
    if (filters.type !== undefined) {
      qb.andWhere('n.type = :type', { type: filters.type });
    }
    if (cursor !== null) {
      qb.andWhere('(n.created_at, n.id) < (:ck::timestamptz, :cid::uuid)', {
        ck: cursor.k,
        cid: cursor.id,
      });
    }
    return qb.getMany();
  }

  private applyStatus(qb: SelectQueryBuilder<Notification>, status?: NotificationStatus): void {
    switch (status) {
      case NotificationStatus.Unread:
        qb.andWhere('n.read_at IS NULL').andWhere('n.archived_at IS NULL');
        break;
      case NotificationStatus.Read:
        qb.andWhere('n.read_at IS NOT NULL').andWhere('n.archived_at IS NULL');
        break;
      case NotificationStatus.Archived:
        qb.andWhere('n.archived_at IS NOT NULL');
        break;
      default:
        // Active inbox: unread + read, but not archived.
        qb.andWhere('n.archived_at IS NULL');
    }
  }

  /** O(1)-ish unread count via the partial `idx_notifications_unread` index. */
  countUnread(recipientId: string): Promise<number> {
    return this.repo
      .createQueryBuilder('n')
      .where('n.recipient_id = :recipientId', { recipientId })
      .andWhere('n.read_at IS NULL')
      .andWhere('n.archived_at IS NULL')
      .andWhere('n.deleted_at IS NULL')
      .getCount();
  }

  /** Marks a loaded notification read (no-op if already read). */
  async markRead(notification: Notification): Promise<void> {
    if (notification.readAt === null) {
      notification.readAt = new Date();
      await this.repo.save(notification);
    }
  }

  /** Marks every unread, non-archived notification read; returns rows changed. */
  async markAllRead(recipientId: string): Promise<number> {
    const result = await this.repo
      .createQueryBuilder()
      .update(Notification)
      .set({ readAt: () => 'now()' })
      .where('recipient_id = :recipientId', { recipientId })
      .andWhere('read_at IS NULL')
      .andWhere('archived_at IS NULL')
      .andWhere('deleted_at IS NULL')
      .execute();
    return result.affected ?? 0;
  }

  /** Archives a loaded notification (also marks read so it leaves the unread count). */
  async archive(notification: Notification): Promise<void> {
    notification.archivedAt = new Date();
    notification.readAt ??= new Date();
    await this.repo.save(notification);
  }

  /** Soft-deletes a loaded notification (tombstone; excluded from every read). */
  async softDelete(notification: Notification): Promise<void> {
    await this.repo.softRemove(notification);
  }

  /**
   * Recipient ids eligible for a broadcast: active, non-deleted users whose
   * `system` preference is on (or who have no preference row → default on).
   */
  async broadcastRecipientIds(): Promise<string[]> {
    const rows = (await this.dataSource.query(
      `SELECT u.id AS id
         FROM users u
         LEFT JOIN notification_preferences np ON np.user_id = u.id
        WHERE u.status = 'active' AND u.deleted_at IS NULL
          AND (np.user_id IS NULL OR np.system = true)`,
    )) as Array<{ id: string }>;
    return rows.map((r) => r.id);
  }

  /** Count of broadcast-eligible recipients (for the async-broadcast delivered estimate). */
  async countBroadcastRecipients(): Promise<number> {
    const rows = (await this.dataSource.query(
      `SELECT COUNT(*)::int AS count
         FROM users u
         LEFT JOIN notification_preferences np ON np.user_id = u.id
        WHERE u.status = 'active' AND u.deleted_at IS NULL
          AND (np.user_id IS NULL OR np.system = true)`,
    )) as Array<{ count: number }>;
    return rows[0]?.count ?? 0;
  }

  /**
   * Hard-deletes notifications created before `cutoff` (retention prune — docs 04
   * §3.7). Removes rows in any state, soft-deleted or not; 12-month-old inbox
   * entries are gone for good. Returns the number removed.
   */
  async deleteOlderThan(cutoff: Date): Promise<number> {
    const result = await this.repo
      .createQueryBuilder()
      .delete()
      .from(Notification)
      .where('created_at < :cutoff', { cutoff })
      .execute();
    return result.affected ?? 0;
  }
}
