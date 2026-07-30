import type { ConfigType } from '@nestjs/config';

import { JOB, QUEUE } from '../../common/queue/queue.constants';
import type { infrastructureConfig } from '../../config/infrastructure.config';
import { QueueProducer } from './queue-producer.service';
import type { QueueRegistry } from './queue-registry.service';

function build() {
  const add = jest.fn().mockResolvedValue(undefined);
  const registry = { get: jest.fn().mockReturnValue({ add }) };
  const config = {
    policies: {
      [QUEUE.Notifications]: {
        attempts: 5,
        backoffMs: 5_000,
        priority: 3,
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
      [QUEUE.TrendingScore]: {
        attempts: 3, // queue default; JOB_RETRY overrides TrendingRecompute → 1
        backoffMs: 5_000,
        priority: 4,
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    },
  } as unknown as ConfigType<typeof infrastructureConfig>;
  const producer = new QueueProducer(registry as unknown as QueueRegistry, config);
  return { producer, registry, add };
}

describe('QueueProducer', () => {
  it('builds job options from the queue policy (derived from the job)', () => {
    const { producer } = build();
    const opts = producer.buildJobOptions(JOB.Broadcast, {});
    expect(opts).toMatchObject({
      attempts: 5,
      backoff: { type: 'exponential', delay: 5_000 },
      priority: 3,
      removeOnComplete: 100,
      removeOnFail: 1000,
    });
    expect(opts).not.toHaveProperty('jobId');
  });

  it('applies the per-job retry override over the queue default', () => {
    const { producer } = build();
    // trending-score queue default is attempts 3, but JOB_RETRY pins recompute to 1.
    expect(producer.buildJobOptions(JOB.TrendingRecompute, {}).attempts).toBe(1);
  });

  it('applies per-call overrides (highest precedence)', () => {
    const { producer } = build();
    const opts = producer.buildJobOptions(JOB.Broadcast, {
      attempts: 2,
      priority: 9,
      jobId: 'x',
      delayMs: 2_000,
    });
    expect(opts).toMatchObject({ attempts: 2, priority: 9, jobId: 'x', delay: 2_000 });
  });

  it('enqueues on the queue derived from the job, with a stamped requestId', async () => {
    const { producer, registry, add } = build();
    await producer.enqueue(JOB.Broadcast, { recordId: 'r1' }, { requestId: 'req-123' });
    expect(registry.get).toHaveBeenCalledWith(QUEUE.Notifications);
    const [name, payload] = add.mock.calls[0];
    expect(name).toBe(JOB.Broadcast);
    expect(payload).toEqual({
      recordId: 'r1',
      meta: { requestId: 'req-123', enqueuedFor: JOB.Broadcast },
    });
  });

  it('mints a requestId when none is provided', async () => {
    const { producer, add } = build();
    await producer.enqueue(JOB.Broadcast, { recordId: 'r1' });
    const payload = add.mock.calls[0][1] as { meta: { requestId: string } };
    expect(typeof payload.meta.requestId).toBe('string');
    expect(payload.meta.requestId.length).toBeGreaterThan(0);
  });
});
