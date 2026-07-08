import { DomainEventBus } from './domain-event-bus';
import { DomainEventType } from './domain-events';

describe('DomainEventBus', () => {
  it('delivers an event to every registered handler and awaits them', async () => {
    const bus = new DomainEventBus();
    const seen: string[] = [];
    bus.on(DomainEventType.UserFollowed, (e) => {
      seen.push(`a:${e.followerId}`);
    });
    bus.on(DomainEventType.UserFollowed, async (e) => {
      await Promise.resolve();
      seen.push(`b:${e.followeeId}`);
    });

    await bus.emit(DomainEventType.UserFollowed, {
      followId: 'f1',
      followerId: 'x',
      followeeId: 'y',
      status: 'accepted',
    });

    expect(seen).toEqual(['a:x', 'b:y']);
  });

  it('isolates a throwing handler — emit still resolves and other handlers run', async () => {
    const bus = new DomainEventBus();
    const ok = jest.fn();
    bus.on(DomainEventType.PiecePublished, () => {
      throw new Error('boom');
    });
    bus.on(DomainEventType.PiecePublished, ok);

    await expect(
      bus.emit(DomainEventType.PiecePublished, { pieceId: 'p1', authorId: 'a1' }),
    ).resolves.toBeUndefined();
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it('no-ops when nothing is subscribed', async () => {
    const bus = new DomainEventBus();
    await expect(
      bus.emit(DomainEventType.ReactionCreated, {
        kind: 'clap',
        pieceId: 'p',
        pieceAuthorId: 'a',
        actorId: 'b',
      }),
    ).resolves.toBeUndefined();
  });
});
