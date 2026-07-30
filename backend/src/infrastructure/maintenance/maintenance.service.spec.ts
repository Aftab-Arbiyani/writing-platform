import type { ConfigType } from '@nestjs/config';
import type { DataSource } from 'typeorm';

import type { infrastructureConfig } from '../../config/infrastructure.config';
import type { AuthMaintenanceService } from '../../modules/auth/services/auth-maintenance.service';
import type { NotificationsService } from '../../modules/notifications/notifications.service';
import type { PiecesService } from '../../modules/pieces/pieces.service';
import { MaintenanceService } from './maintenance.service';

function build(queryImpl?: jest.Mock) {
  const auth = {
    pruneExpiredTokens: jest.fn().mockResolvedValue({ verification: 4, passwordReset: 2 }),
  };
  const notifications = { pruneOlderThan: jest.fn().mockResolvedValue(11) };
  const pieces = { purgeSoftDeleted: jest.fn().mockResolvedValue(3) };
  const dataSource = { query: queryImpl ?? jest.fn().mockResolvedValue([]) };
  const config = {
    retention: { expiredTokenDays: 1, notificationDays: 365, softDeleteDays: 30 },
  } as unknown as ConfigType<typeof infrastructureConfig>;
  const service = new MaintenanceService(
    auth as unknown as AuthMaintenanceService,
    notifications as unknown as NotificationsService,
    pieces as unknown as PiecesService,
    dataSource as unknown as DataSource,
    config,
  );
  return { service, auth, notifications, pieces, dataSource };
}

describe('MaintenanceService', () => {
  it('dailyCleanup prunes tokens, notifications, and soft-deleted pieces', async () => {
    const { service, auth, notifications, pieces } = build();
    const result = await service.dailyCleanup();
    expect(auth.pruneExpiredTokens).toHaveBeenCalledWith(expect.any(Date));
    expect(notifications.pruneOlderThan).toHaveBeenCalledWith(expect.any(Date));
    expect(pieces.purgeSoftDeleted).toHaveBeenCalledWith(expect.any(Date));
    expect(result).toEqual({
      expiredVerificationTokens: 4,
      expiredPasswordResetTokens: 2,
      prunedNotifications: 11,
      purgedSoftDeletedPieces: 3,
    });
  });

  it('derives cutoffs from the configured retention windows', async () => {
    const { service, notifications } = build();
    const before = Date.now();
    await service.dailyCleanup();
    const cutoff = (notifications.pruneOlderThan.mock.calls[0][0] as Date).getTime();
    // 365-day notification retention → cutoff roughly one year in the past.
    const daysAgo = (before - cutoff) / 86_400_000;
    expect(daysAgo).toBeGreaterThan(364);
    expect(daysAgo).toBeLessThan(366);
  });

  it('weeklyDbMaintenance runs ANALYZE and surfaces VACUUM recommendations', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce(undefined) // ANALYZE
      .mockResolvedValueOnce([{ relname: 'pieces', n_dead_tup: '5000', n_live_tup: '1000' }]);
    const { service } = build(query);
    const result = await service.weeklyDbMaintenance();
    expect(query).toHaveBeenNthCalledWith(1, 'ANALYZE');
    expect(result.analyzed).toBe(true);
    expect(result.recommendations).toEqual([
      { table: 'pieces', deadTuples: 5000, liveTuples: 1000 },
    ]);
  });
});
