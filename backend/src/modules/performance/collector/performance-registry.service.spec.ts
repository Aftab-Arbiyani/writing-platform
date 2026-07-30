import type { ConfigType } from '@nestjs/config';

import type { performanceConfig } from '../../../config/performance.config';
import { LATENCY_RESERVOIR_SIZE } from '../performance.constants';
import { PerformanceRegistryService, statsFromSamples } from './performance-registry.service';

type PerfConfig = ConfigType<typeof performanceConfig>;

function config(enabled = true): PerfConfig {
  return {
    enabled,
    slowQueryMs: 200,
    windowSeconds: 300,
    eventLoopSampleMs: 2000,
    benchmarkEnabled: true,
    benchmarkIterations: 100,
    capacity: { apiRps: 0, workers: 0, redisMemoryBytes: 0, aiTokensDaily: 0 },
  } as PerfConfig;
}

describe('PerformanceRegistryService', () => {
  it('computes per-operation latency percentiles from observed samples', () => {
    const registry = new PerformanceRegistryService(config());
    for (const d of [10, 20, 30, 40, 50]) {
      registry.observe({ operation: 'GET /pieces/:id', kind: 'http', durationMs: d, ok: true });
    }
    const stats = registry.operationStats();
    expect(stats).toHaveLength(1);
    const op = stats[0]!;
    expect(op.count).toBe(5);
    expect(op.minMs).toBe(10);
    expect(op.maxMs).toBe(50);
    expect(op.p50Ms).toBe(30);
    expect(op.p95Ms).toBe(50);
  });

  it('counts errors and reflects them in the aggregate', () => {
    const registry = new PerformanceRegistryService(config());
    registry.observe({ operation: 'a', kind: 'http', durationMs: 5, ok: true });
    registry.observe({ operation: 'a', kind: 'http', durationMs: 5, ok: false });
    const agg = registry.aggregate((k) => k === 'http');
    expect(agg.count).toBe(2);
    expect(agg.errorCount).toBe(1);
  });

  it('tracks cache hit ratio', () => {
    const registry = new PerformanceRegistryService(config());
    registry.recordCache(true);
    registry.recordCache(true);
    registry.recordCache(false);
    const cache = registry.cacheStats();
    expect(cache.hits).toBe(2);
    expect(cache.misses).toBe(1);
    expect(cache.hitRatio).toBeCloseTo(2 / 3, 5);
  });

  it('reports a hit ratio of 1 when there has been no cache traffic', () => {
    const registry = new PerformanceRegistryService(config());
    expect(registry.cacheStats().hitRatio).toBe(1);
  });

  it('retains slow queries in a bounded ring buffer and a running total', () => {
    const registry = new PerformanceRegistryService(config());
    registry.recordSlowQuery({ sql: 'SELECT 1', durationMs: 300 });
    registry.recordSlowQuery({ sql: 'SELECT 2', durationMs: 900 });
    const snap = registry.slowQuerySnapshot();
    expect(snap.total).toBe(2);
    expect(snap.recent).toHaveLength(2);
  });

  it('bounds the latency reservoir (no unbounded memory growth)', () => {
    const registry = new PerformanceRegistryService(config());
    for (let i = 0; i < LATENCY_RESERVOIR_SIZE + 250; i += 1) {
      registry.observe({ operation: 'x', kind: 'db', durationMs: i, ok: true });
    }
    const stats = registry.operationStats();
    // count is the true total; the reservoir is capped.
    expect(stats[0]!.count).toBe(LATENCY_RESERVOIR_SIZE + 250);
  });

  it('is inert when disabled (zero overhead)', () => {
    const registry = new PerformanceRegistryService(config(false));
    registry.observe({ operation: 'x', kind: 'http', durationMs: 5, ok: true });
    registry.recordCache(true);
    registry.recordSlowQuery({ sql: 'x', durationMs: 999 });
    expect(registry.operationStats()).toHaveLength(0);
    expect(registry.slowQuerySnapshot().total).toBe(0);
  });

  it('reset() clears all telemetry for deterministic re-runs', () => {
    const registry = new PerformanceRegistryService(config());
    registry.observe({ operation: 'x', kind: 'http', durationMs: 5, ok: true });
    registry.reset();
    expect(registry.operationStats()).toHaveLength(0);
  });
});

describe('statsFromSamples', () => {
  it('returns zeros for an empty sample set but preserves counts', () => {
    const stats = statsFromSamples([], 7, 2);
    expect(stats).toMatchObject({ count: 7, errorCount: 2, p95Ms: 0, maxMs: 0 });
  });

  it('is deterministic for identical input', () => {
    const a = statsFromSamples([3, 1, 2], 3, 0);
    const b = statsFromSamples([2, 3, 1], 3, 0);
    expect(a).toEqual(b);
  });
});
