import type { ConfigType } from '@nestjs/config';

import type { infrastructureConfig } from '../../config/infrastructure.config';
import type { RedisService } from '../../redis/redis.service';
import { CacheService } from './cache.service';

/** A Map-backed Redis stand-in with NX-lock + SCAN semantics for stampede tests. */
function memRedis() {
  const store = new Map<string, string>();
  const client = {
    get: jest.fn(async (k: string) => store.get(k) ?? null),
    set: jest.fn(async (k: string, v: string, _ex?: string, _ttl?: number, nx?: string) => {
      if (nx === 'NX' && store.has(k)) {
        return null;
      }
      store.set(k, v);
      return 'OK';
    }),
    del: jest.fn(async (...keys: string[]) => {
      let n = 0;
      for (const k of keys) {
        if (store.delete(k)) n += 1;
      }
      return n;
    }),
    scan: jest.fn(async (_cursor: string, _match: string, pattern: string) => {
      const prefix = pattern.replace(/\*$/, '');
      return ['0', [...store.keys()].filter((k) => k.startsWith(prefix))];
    }),
    flushdb: jest.fn(async () => {
      store.clear();
      return 'OK';
    }),
    info: jest.fn(async () => 'used_memory_human:1.50M\r\n'),
  };
  return { client, store };
}

function build() {
  const { client, store } = memRedis();
  const redis = { getClient: jest.fn().mockReturnValue(client) };
  const config = {
    cacheTtl: { stampedeLock: 5 },
  } as unknown as ConfigType<typeof infrastructureConfig>;
  const service = new CacheService(redis as unknown as RedisService, config);
  return { service, client, store };
}

describe('CacheService', () => {
  it('get parses JSON on a hit, null on a miss', async () => {
    const { service, store } = build();
    store.set('k', '{"a":1}');
    expect(await service.get<{ a: number }>('k')).toEqual({ a: 1 });
    expect(await service.get('missing')).toBeNull();
  });

  it('set writes JSON with an EX ttl', async () => {
    const { service, client } = build();
    await service.set('k', { a: 1 }, 300);
    expect(client.set).toHaveBeenCalledWith('k', '{"a":1}', 'EX', 300);
  });

  it('wrap returns the cached value without computing on a hit', async () => {
    const { service, store } = build();
    store.set('k', '"cached"');
    const compute = jest.fn().mockResolvedValue('fresh');
    expect(await service.wrap('k', 60, compute)).toBe('cached');
    expect(compute).not.toHaveBeenCalled();
  });

  it('wrap computes and caches on a miss', async () => {
    const { service, store } = build();
    const compute = jest.fn().mockResolvedValue({ v: 1 });
    expect(await service.wrap('k', 60, compute)).toEqual({ v: 1 });
    expect(compute).toHaveBeenCalledTimes(1);
    expect(store.get('k')).toBe('{"v":1}');
  });

  it('wrap prevents a stampede: concurrent misses compute only once', async () => {
    const { service } = build();
    let calls = 0;
    const compute = jest.fn(async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 30));
      return 'value';
    });
    const [a, b] = await Promise.all([
      service.wrap('hot', 60, compute),
      service.wrap('hot', 60, compute),
    ]);
    expect(a).toBe('value');
    expect(b).toBe('value');
    expect(calls).toBe(1);
  });

  it('delByPrefix removes matching keys via SCAN', async () => {
    const { service, store } = build();
    store.set('feed:a', '1');
    store.set('feed:b', '1');
    store.set('search:c', '1');
    expect(await service.delByPrefix('feed:')).toBe(2);
    expect(store.has('feed:a')).toBe(false);
    expect(store.has('search:c')).toBe(true);
  });

  it('flushAll clears the cache DB', async () => {
    const { service, store, client } = build();
    store.set('x', '1');
    await service.flushAll();
    expect(client.flushdb).toHaveBeenCalled();
    expect(store.size).toBe(0);
  });

  it('stats groups key counts by prefix and reports memory', async () => {
    const { service, store } = build();
    store.set('feed:a', '1');
    store.set('feed:b', '1');
    store.set('search:c', '1');
    const stats = await service.stats();
    expect(stats.keys).toBe(3);
    expect(stats.byPrefix['feed:']).toBe(2);
    expect(stats.byPrefix['search:']).toBe(1);
    expect(stats.usedMemory).toBe('1.50M');
  });

  it('degrades gracefully when Redis get throws (returns null)', async () => {
    const { service, client } = build();
    client.get.mockRejectedValueOnce(new Error('down'));
    expect(await service.get('k')).toBeNull();
  });
});
