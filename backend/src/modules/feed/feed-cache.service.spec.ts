import type { RedisService } from '../../redis/redis.service';
import { FeedCacheService } from './feed-cache.service';

function build(clientOverrides: Record<string, jest.Mock> = {}) {
  const client = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    ...clientOverrides,
  };
  const redis = { getClient: jest.fn().mockReturnValue(client) };
  const service = new FeedCacheService(redis as unknown as RedisService);
  return { service, client };
}

describe('FeedCacheService', () => {
  it('parses cached JSON on a hit', async () => {
    const { service } = build({ get: jest.fn().mockResolvedValue('{"a":1}') });
    expect(await service.get<{ a: number }>('k')).toEqual({ a: 1 });
  });

  it('returns null on a miss', async () => {
    const { service } = build();
    expect(await service.get('k')).toBeNull();
  });

  it('degrades gracefully when Redis errors (get → null)', async () => {
    const { service } = build({ get: jest.fn().mockRejectedValue(new Error('down')) });
    expect(await service.get('k')).toBeNull();
  });

  it('sets with an EX ttl', async () => {
    const { service, client } = build();
    await service.set('k', { a: 1 }, 300);
    expect(client.set).toHaveBeenCalledWith('k', '{"a":1}', 'EX', 300);
  });

  it('remember returns the cached value without computing on a hit', async () => {
    const { service } = build({ get: jest.fn().mockResolvedValue('"cached"') });
    const compute = jest.fn().mockResolvedValue('fresh');
    expect(await service.remember('k', 60, compute)).toBe('cached');
    expect(compute).not.toHaveBeenCalled();
  });

  it('remember computes + caches on a miss', async () => {
    const { service, client } = build();
    const compute = jest.fn().mockResolvedValue('fresh');
    expect(await service.remember('k', 60, compute)).toBe('fresh');
    expect(compute).toHaveBeenCalledTimes(1);
    expect(client.set).toHaveBeenCalledWith('k', '"fresh"', 'EX', 60);
  });

  it('invalidates keys', async () => {
    const { service, client } = build();
    await service.invalidateTrending();
    expect(client.del).toHaveBeenCalled();
  });
});
