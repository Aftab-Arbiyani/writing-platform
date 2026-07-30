import { QUEUE } from '../../common/queue/queue.constants';
import type { DeadLetterService } from '../queue/dead-letter.service';
import type { QueueRegistry } from '../queue/queue-registry.service';
import { QueueMonitorService } from './queue-monitor.service';

function build() {
  const queue = {
    getJobCounts: jest
      .fn()
      .mockResolvedValue({ waiting: 2, active: 1, completed: 5, failed: 1, delayed: 0, paused: 0 }),
    isPaused: jest.fn().mockResolvedValue(false),
    getWaiting: jest.fn().mockResolvedValue([{ timestamp: Date.now() - 5_000 }]),
    getWorkers: jest.fn().mockResolvedValue([{}, {}]),
  };
  const registry = { get: jest.fn().mockReturnValue(queue) };
  const deadLetter = { retry: jest.fn().mockResolvedValue(true) };
  const service = new QueueMonitorService(
    registry as unknown as QueueRegistry,
    deadLetter as unknown as DeadLetterService,
  );
  return { service, queue, deadLetter };
}

describe('QueueMonitorService', () => {
  it('builds a queue status with counts, worker count, and oldest-waiting age', async () => {
    const { service } = build();
    const status = await service.queueStatus(QUEUE.Notifications);
    expect(status.name).toBe(QUEUE.Notifications);
    expect(status.paused).toBe(false);
    expect(status.counts).toMatchObject({ waiting: 2, active: 1, failed: 1 });
    expect(status.workers).toBe(2);
    expect(status.oldestWaitingAgeMs).toBeGreaterThanOrEqual(4_000);
  });

  it('reports zero oldest-waiting age when there are no waiting jobs', async () => {
    const { service, queue } = build();
    queue.getWaiting.mockResolvedValueOnce([]);
    const status = await service.queueStatus(QUEUE.Cache);
    expect(status.oldestWaitingAgeMs).toBe(0);
  });

  it('delegates retryJob to the dead-letter service', async () => {
    const { service, deadLetter } = build();
    expect(await service.retryJob(QUEUE.Notifications, 'j1')).toBe(true);
    expect(deadLetter.retry).toHaveBeenCalledWith(QUEUE.Notifications, 'j1');
  });
});
