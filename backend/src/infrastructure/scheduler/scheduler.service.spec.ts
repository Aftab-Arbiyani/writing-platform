import type { ConfigType } from '@nestjs/config';

import type { infrastructureConfig } from '../../config/infrastructure.config';
import type { QueueProducer } from '../queue/queue-producer.service';
import type { QueueRegistry } from '../queue/queue-registry.service';
import { SchedulerService } from './scheduler.service';

function build(schedulerEnabled: boolean) {
  const upsertJobScheduler = jest.fn().mockResolvedValue(undefined);
  const registry = { get: jest.fn().mockReturnValue({ upsertJobScheduler }) };
  const producer = { buildJobOptions: jest.fn().mockReturnValue({ attempts: 3 }) };
  const config = {
    schedulerEnabled,
    cron: {
      scheduledPublish: '* * * * *',
      trendingRecompute: '0 * * * *',
      analyticsHourlySnapshot: '0 * * * *',
      analyticsNightlyRollup: '0 3 * * *',
      dailyCleanup: '0 4 * * *',
      weeklyDbMaintenance: '0 5 * * 0',
      cacheOptimize: '30 5 * * 0',
      cacheWarm: '*/15 * * * *',
    },
  } as unknown as ConfigType<typeof infrastructureConfig>;
  const service = new SchedulerService(
    registry as unknown as QueueRegistry,
    producer as unknown as QueueProducer,
    config,
  );
  return { service, upsertJobScheduler };
}

describe('SchedulerService', () => {
  it('registers every cron definition on bootstrap when enabled', async () => {
    const { service, upsertJobScheduler } = build(true);
    expect(service.definitions()).toHaveLength(8);

    await service.onApplicationBootstrap();
    expect(upsertJobScheduler).toHaveBeenCalledTimes(8);
    // Each registration passes its cron pattern + a job template.
    const firstCall = upsertJobScheduler.mock.calls[0];
    expect(firstCall[0]).toBe('sched:scheduled-publish');
    expect(firstCall[1]).toEqual({ pattern: '* * * * *' });
    expect(firstCall[2]).toMatchObject({ name: 'publish-due' });
  });

  it('registers nothing when the scheduler is disabled', async () => {
    const { service, upsertJobScheduler } = build(false);
    await service.onApplicationBootstrap();
    expect(upsertJobScheduler).not.toHaveBeenCalled();
  });

  it('does not throw if a registration fails (logs and continues)', async () => {
    const { service, upsertJobScheduler } = build(true);
    upsertJobScheduler.mockRejectedValueOnce(new Error('redis down'));
    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    // The remaining 7 still register despite the first failing.
    expect(upsertJobScheduler).toHaveBeenCalledTimes(8);
  });
});
