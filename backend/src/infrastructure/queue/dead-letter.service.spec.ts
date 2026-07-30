import { QUEUE } from '../../common/queue/queue.constants';
import { DeadLetterService } from './dead-letter.service';
import type { QueueRegistry } from './queue-registry.service';

function build(job: unknown) {
  const queue = {
    getJob: jest.fn().mockResolvedValue(job),
    getFailed: jest.fn().mockResolvedValue([]),
    getFailedCount: jest.fn().mockResolvedValue(3),
  };
  const registry = { get: jest.fn().mockReturnValue(queue) };
  const service = new DeadLetterService(registry as unknown as QueueRegistry);
  return { service, queue };
}

describe('DeadLetterService', () => {
  it('retries a job that is in the failed state', async () => {
    const retry = jest.fn().mockResolvedValue(undefined);
    const { service } = build({ getState: jest.fn().mockResolvedValue('failed'), retry });
    expect(await service.retry(QUEUE.Notifications, 'j1')).toBe(true);
    expect(retry).toHaveBeenCalled();
  });

  it('refuses to retry a job that is not failed', async () => {
    const retry = jest.fn();
    const { service } = build({ getState: jest.fn().mockResolvedValue('completed'), retry });
    expect(await service.retry(QUEUE.Notifications, 'j1')).toBe(false);
    expect(retry).not.toHaveBeenCalled();
  });

  it('returns false for an unknown job id', async () => {
    const { service } = build(undefined);
    expect(await service.retry(QUEUE.Notifications, 'nope')).toBe(false);
  });

  it('discards a job by removing it', async () => {
    const remove = jest.fn().mockResolvedValue(undefined);
    const { service } = build({ remove });
    expect(await service.discard(QUEUE.Notifications, 'j1')).toBe(true);
    expect(remove).toHaveBeenCalled();
  });

  it('reports the failed (dead-letter) count', async () => {
    const { service } = build(undefined);
    expect(await service.count(QUEUE.Notifications)).toBe(3);
  });
});
