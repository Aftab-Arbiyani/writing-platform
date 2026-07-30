import type { DomainEventBus } from '../../common/events/domain-event-bus';
import { DomainEventType } from '../../common/events/domain-events';
import { JOB } from '../../common/queue/queue.constants';
import type { QueueProducer } from '../queue/queue-producer.service';
import { EventBridgeService } from './event-bridge.service';

type Handler = (payload: unknown) => unknown;

function build() {
  const handlers = new Map<string, Handler>();
  const bus = { on: jest.fn((event: string, handler: Handler) => handlers.set(event, handler)) };
  const producer = { enqueue: jest.fn().mockResolvedValue(undefined) };
  const service = new EventBridgeService(
    bus as unknown as DomainEventBus,
    producer as unknown as QueueProducer,
  );
  return { service, producer, handlers };
}

describe('EventBridgeService', () => {
  it('subscribes to piece.published and piece.archived on init', () => {
    const { service, handlers } = build();
    service.onModuleInit();
    expect(handlers.has(DomainEventType.PiecePublished)).toBe(true);
    expect(handlers.has(DomainEventType.PieceArchived)).toBe(true);
  });

  it('enqueues a coalesced cache-invalidate job on publish', async () => {
    const { service, producer, handlers } = build();
    service.onModuleInit();
    await handlers.get(DomainEventType.PiecePublished)?.({ pieceId: 'p1', authorId: 'a1' });

    expect(producer.enqueue).toHaveBeenCalledTimes(1);
    const [job, data, opts] = producer.enqueue.mock.calls[0];
    expect(job).toBe(JOB.CacheInvalidate);
    expect(Array.isArray((data as { keys: string[] }).keys)).toBe(true);
    // Stable jobId + delay coalesces a burst into a single invalidation.
    expect(opts).toMatchObject({ jobId: 'cache-invalidate:discovery', delayMs: 2_000 });
  });

  it('also invalidates on archive', async () => {
    const { service, producer, handlers } = build();
    service.onModuleInit();
    await handlers.get(DomainEventType.PieceArchived)?.({ pieceId: 'p1', authorId: 'a1' });
    expect(producer.enqueue).toHaveBeenCalledTimes(1);
  });
});
