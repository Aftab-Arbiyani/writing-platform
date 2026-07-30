import type { JobEnqueuer } from '../../common/queue/job-enqueuer.port';
import { JOB } from '../../common/queue/queue.constants';
import type { NotificationPreferencesRepository } from './notification-preferences.repository';
import { NotificationsService } from './notifications.service';
import type { NotificationsCacheService } from './notifications-cache.service';
import type { NotificationsRepository } from './notifications.repository';
import type { SystemNotificationsRepository } from './system-notifications.repository';

const RECORD = {
  id: 'sn1',
  title: 'Maintenance',
  body: 'Down at 2am',
  data: {},
  createdBy: 'admin1',
  audience: 'all',
  createdAt: new Date('2026-07-09T00:00:00Z'),
};

function build(jobs?: JobEnqueuer) {
  const notifications = {
    broadcastRecipientIds: jest.fn().mockResolvedValue(['u1', 'u2', 'u3']),
    countBroadcastRecipients: jest.fn().mockResolvedValue(3),
    createMany: jest.fn().mockResolvedValue(undefined),
    deleteOlderThan: jest.fn().mockResolvedValue(7),
  };
  const preferences = {};
  const systemNotifications = {
    create: jest.fn().mockResolvedValue(RECORD),
    findById: jest.fn().mockResolvedValue(RECORD),
  };
  const cache = { invalidateMany: jest.fn().mockResolvedValue(undefined) };
  const service = new NotificationsService(
    notifications as unknown as NotificationsRepository,
    preferences as unknown as NotificationPreferencesRepository,
    systemNotifications as unknown as SystemNotificationsRepository,
    cache as unknown as NotificationsCacheService,
    jobs,
  );
  return { service, notifications, systemNotifications, cache };
}

describe('NotificationsService — broadcast & maintenance (Epic 11)', () => {
  it('fanOutSystemNotification inserts one row per recipient and invalidates caches', async () => {
    const { service, notifications, cache } = build();
    const delivered = await service.fanOutSystemNotification('sn1');
    expect(delivered).toBe(3);
    expect(notifications.createMany).toHaveBeenCalled();
    expect(cache.invalidateMany).toHaveBeenCalledWith(['u1', 'u2', 'u3']);
  });

  it('fanOutSystemNotification is a no-op for a missing record', async () => {
    const { service, systemNotifications, notifications } = build();
    systemNotifications.findById.mockResolvedValueOnce(null);
    expect(await service.fanOutSystemNotification('gone')).toBe(0);
    expect(notifications.createMany).not.toHaveBeenCalled();
  });

  it('createSystemNotification fans out synchronously when no queue is wired', async () => {
    const { service, notifications } = build();
    const dto = await service.createSystemNotification('admin1', { title: 'T', body: 'B' });
    expect(notifications.createMany).toHaveBeenCalled();
    expect(dto.deliveredCount).toBe(3);
  });

  it('createSystemNotification enqueues the fan-out when a queue is wired', async () => {
    const enqueue = jest.fn().mockResolvedValue(undefined);
    const { service, notifications } = build({ enqueue });
    const dto = await service.createSystemNotification('admin1', { title: 'T', body: 'B' });

    expect(enqueue).toHaveBeenCalledWith(JOB.Broadcast, { recordId: 'sn1' });
    // Fan-out is deferred to the worker — no inline insert on the request path.
    expect(notifications.createMany).not.toHaveBeenCalled();
    expect(dto.deliveredCount).toBe(3); // eligible-recipient estimate
  });

  it('pruneOlderThan delegates to the repository', async () => {
    const { service, notifications } = build();
    const cutoff = new Date('2025-07-09T00:00:00Z');
    expect(await service.pruneOlderThan(cutoff)).toBe(7);
    expect(notifications.deleteOlderThan).toHaveBeenCalledWith(cutoff);
  });
});
