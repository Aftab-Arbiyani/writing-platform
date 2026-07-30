import { NotificationEntityType, NotificationType } from '@qalam/shared';

import type { NotificationQueryDto } from './dto/notification-query.dto';
import type { NotificationPreference } from './entities/notification-preference.entity';
import type { Notification } from './entities/notification.entity';
import {
  NotificationNotFoundException,
  SystemNotificationNotFoundException,
} from './notifications.exceptions';
import type { NotificationsCacheService } from './notifications-cache.service';
import type { NotificationPreferencesRepository } from './notification-preferences.repository';
import { NotificationsService } from './notifications.service';
import type { NotificationsRepository } from './notifications.repository';
import type { SystemNotificationsRepository } from './system-notifications.repository';

function prefs(overrides: Partial<NotificationPreference> = {}): NotificationPreference {
  return {
    userId: 'u1',
    follow: true,
    comment: true,
    reply: true,
    reaction: true,
    mention: true,
    response: true,
    system: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function build() {
  const notifications = {
    create: jest.fn().mockResolvedValue({ id: 'n1' }),
    createMany: jest.fn().mockResolvedValue(undefined),
    findActiveDuplicate: jest.fn().mockResolvedValue(false),
    findOwned: jest.fn(),
    list: jest.fn().mockResolvedValue([]),
    countUnread: jest.fn().mockResolvedValue(0),
    markRead: jest.fn().mockResolvedValue(undefined),
    markAllRead: jest.fn().mockResolvedValue(0),
    archive: jest.fn().mockResolvedValue(undefined),
    softDelete: jest.fn().mockResolvedValue(undefined),
    broadcastRecipientIds: jest.fn().mockResolvedValue(['r1', 'r2']),
  };
  const preferences = {
    find: jest.fn().mockResolvedValue(null),
    upsert: jest
      .fn()
      .mockImplementation((userId: string, patch: Partial<NotificationPreference>) =>
        Promise.resolve(prefs({ userId, ...patch })),
      ),
  };
  const systemNotifications = {
    create: jest.fn().mockResolvedValue({
      id: 's1',
      title: 'T',
      body: 'B',
      data: {},
      createdBy: 'admin',
      audience: 'all',
      createdAt: new Date(),
    }),
    list: jest.fn().mockResolvedValue([]),
    findById: jest.fn(),
    softDelete: jest.fn().mockResolvedValue(undefined),
  };
  const cache = {
    getUnreadCount: jest.fn((_userId: string, compute: () => Promise<number>) => compute()),
    invalidate: jest.fn().mockResolvedValue(undefined),
    invalidateMany: jest.fn().mockResolvedValue(undefined),
  };
  const service = new NotificationsService(
    notifications as unknown as NotificationsRepository,
    preferences as unknown as NotificationPreferencesRepository,
    systemNotifications as unknown as SystemNotificationsRepository,
    cache as unknown as NotificationsCacheService,
  );
  return { service, notifications, preferences, systemNotifications, cache };
}

const ownedNotification = (overrides: Partial<Notification> = {}): Notification =>
  ({
    id: 'n1',
    recipientId: 'u1',
    actorId: 'a1',
    type: NotificationType.Clap,
    entityType: NotificationEntityType.Piece,
    entityId: 'p1',
    data: {},
    readAt: null,
    archivedAt: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Notification;

describe('NotificationsService', () => {
  describe('create (the single write path)', () => {
    it('creates a notification and invalidates the unread cache', async () => {
      const { service, notifications, cache } = build();
      await service.create({
        recipientId: 'u1',
        actorId: 'a1',
        type: NotificationType.Comment,
        entityType: NotificationEntityType.Piece,
        entityId: 'p1',
        data: { x: 1 },
      });
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'u1',
          actorId: 'a1',
          type: NotificationType.Comment,
        }),
      );
      expect(cache.invalidate).toHaveBeenCalledWith('u1');
    });

    it('never notifies a user of their own action (actor === recipient)', async () => {
      const { service, notifications } = build();
      await service.create({ recipientId: 'u1', actorId: 'u1', type: NotificationType.Clap });
      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('skips a notification whose category the recipient disabled', async () => {
      const { service, notifications, preferences } = build();
      preferences.find.mockResolvedValue(prefs({ reaction: false }));
      await service.create({
        recipientId: 'u1',
        actorId: 'a1',
        type: NotificationType.Clap,
        entityId: 'p1',
      });
      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('de-duplicates a reaction storm when dedupe is set', async () => {
      const { service, notifications } = build();
      notifications.findActiveDuplicate.mockResolvedValue(true);
      await service.create({
        recipientId: 'u1',
        actorId: 'a1',
        type: NotificationType.Clap,
        entityId: 'p1',
        dedupe: true,
      });
      expect(notifications.create).not.toHaveBeenCalled();
    });
  });

  describe('unread count', () => {
    it('reports the count and the 99+ cap flag', async () => {
      const { service, notifications } = build();
      notifications.countUnread.mockResolvedValue(150);
      const result = await service.unreadCount('u1');
      expect(result).toEqual({ count: 150, capped: true });
    });

    it('is not capped below the threshold', async () => {
      const { service, notifications } = build();
      notifications.countUnread.mockResolvedValue(3);
      expect(await service.unreadCount('u1')).toEqual({ count: 3, capped: false });
    });
  });

  describe('mutations are recipient-scoped', () => {
    it('marks a notification read and invalidates the cache', async () => {
      const { service, notifications, cache } = build();
      const n = ownedNotification();
      notifications.findOwned.mockResolvedValue(n);
      await service.markRead('u1', 'n1');
      expect(notifications.markRead).toHaveBeenCalledWith(n);
      expect(cache.invalidate).toHaveBeenCalledWith('u1');
    });

    it('404s when marking a notification that is not the user’s', async () => {
      const { service, notifications } = build();
      notifications.findOwned.mockResolvedValue(null);
      await expect(service.markRead('u1', 'nope')).rejects.toBeInstanceOf(
        NotificationNotFoundException,
      );
    });

    it('404s when archiving a missing notification', async () => {
      const { service, notifications } = build();
      notifications.findOwned.mockResolvedValue(null);
      await expect(service.archive('u1', 'nope')).rejects.toBeInstanceOf(
        NotificationNotFoundException,
      );
    });

    it('marks all read and invalidates the cache', async () => {
      const { service, notifications, cache } = build();
      await service.markAllRead('u1');
      expect(notifications.markAllRead).toHaveBeenCalledWith('u1');
      expect(cache.invalidate).toHaveBeenCalledWith('u1');
    });
  });

  describe('list', () => {
    it('maps rows and passes status/type filters through', async () => {
      const { service, notifications } = build();
      notifications.list.mockResolvedValue([ownedNotification({ readAt: new Date() })]);
      const page = await service.list('u1', {
        limit: 20,
        status: undefined,
        type: undefined,
      } as NotificationQueryDto);
      expect(page.items).toHaveLength(1);
      expect(page.items[0]?.status).toBe('read');
    });
  });

  describe('preferences', () => {
    it('applies only the provided fields', async () => {
      const { service, preferences } = build();
      const result = await service.updatePreferences('u1', { reaction: false });
      expect(preferences.upsert).toHaveBeenCalledWith('u1', { reaction: false });
      expect(result.reaction).toBe(false);
      expect(result.follow).toBe(true);
    });

    it('defaults every category to on when no row exists', async () => {
      const { service } = build();
      expect(await service.getPreferences('u1')).toEqual({
        follow: true,
        comment: true,
        reply: true,
        reaction: true,
        mention: true,
        response: true,
        system: true,
      });
    });
  });

  describe('system broadcasts', () => {
    it('creates the record, fans out to recipients, and reports the delivery count', async () => {
      const { service, notifications, cache } = build();
      const result = await service.createSystemNotification('admin', { title: 'T', body: 'B' });
      expect(notifications.createMany).toHaveBeenCalled();
      expect(cache.invalidateMany).toHaveBeenCalledWith(['r1', 'r2']);
      expect(result.deliveredCount).toBe(2);
    });

    it('404s when deleting a missing system notification', async () => {
      const { service, systemNotifications } = build();
      systemNotifications.findById.mockResolvedValue(null);
      await expect(service.deleteSystemNotification('nope')).rejects.toBeInstanceOf(
        SystemNotificationNotFoundException,
      );
    });
  });
});
