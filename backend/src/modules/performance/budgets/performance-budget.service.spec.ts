import type { PerformanceAnalysis } from '../performance.types';
import { PerformanceBudgetService } from './performance-budget.service';

/** A within-budget analysis fixture (all server-measured budgets pass). */
function healthyAnalysis(): PerformanceAnalysis {
  const stats = {
    count: 100,
    errorCount: 0,
    minMs: 1,
    meanMs: 20,
    p50Ms: 18,
    p95Ms: 120,
    p99Ms: 200,
    maxMs: 300,
  };
  return {
    generatedAt: '2026-07-21T00:00:00.000Z',
    windowSeconds: 300,
    latency: {
      overall: stats,
      byKind: {
        http: { ...stats, p95Ms: 120, p99Ms: 300 },
        cache: { ...stats, p95Ms: 3 },
        queue: { ...stats, p95Ms: 400 },
        search: { ...stats, p95Ms: 200 },
        ai: { ...stats, p95Ms: 8000 },
        storage: { ...stats, p95Ms: 100 },
      },
      slowest: [],
    },
    throughput: {
      windowSeconds: 300,
      totalOperations: 100,
      operationsPerSecond: 0.3,
      errorRatePercent: 0,
      byKind: { http: { count: 100, rps: 0.3, errorRatePercent: 0 } },
      busiest: [],
    },
    cache: { hits: 90, misses: 10, hitRatio: 0.9, p95Ms: 3 },
    resource: {
      uptimeSeconds: 100,
      startupMs: 3000,
      eventLoopLagMeanMs: 2,
      eventLoopLagP95Ms: 10,
      rssBytes: 200_000_000,
      heapUsedBytes: 300_000_000,
      heapTotalBytes: 400_000_000,
      externalBytes: 1_000_000,
      cpuPercent: 20,
      gcCount: 5,
      gcTotalMs: 12,
      activeHandles: 30,
    },
    slowQueries: [],
  };
}

describe('PerformanceBudgetService', () => {
  const service = new PerformanceBudgetService();

  it('exposes the full budget catalogue', () => {
    expect(service.budgets().length).toBeGreaterThan(10);
    expect(service.budgets().some((b) => b.id === 'api.latency.p95')).toBe(true);
  });

  it('passes all server-measured budgets for a healthy analysis', () => {
    const result = service.verify(healthyAnalysis());
    expect(result.failed).toBe(0);
    // Client budgets (frontend/flutter/first-token) are not server-measured.
    expect(result.notMeasured).toBeGreaterThan(0);
  });

  it('fails the p95 latency budget when http p95 exceeds target', () => {
    const analysis = healthyAnalysis();
    const breached: PerformanceAnalysis = {
      ...analysis,
      latency: {
        ...analysis.latency,
        byKind: {
          ...analysis.latency.byKind,
          http: { ...analysis.latency.byKind.http!, p95Ms: 999 },
        },
      },
    };
    const result = service.verify(breached);
    const verdict = result.verdicts.find((v) => v.id === 'api.latency.p95');
    expect(verdict?.status).toBe('fail');
    expect(verdict?.measured).toBe(999);
  });

  it('fails the cache hit-ratio budget when the ratio drops below target', () => {
    const analysis = healthyAnalysis();
    const breached: PerformanceAnalysis = {
      ...analysis,
      cache: { hits: 10, misses: 90, hitRatio: 0.1, p95Ms: 3 },
    };
    const verdict = service.verify(breached).verdicts.find((v) => v.id === 'redis.hit_ratio');
    expect(verdict?.status).toBe('fail');
  });

  it('verifyExternal() checks client budgets against supplied measurements', () => {
    const result = service.verifyExternal({
      'frontend.bundle.initial': 250,
      'flutter.startup.cold': 4000,
    });
    const bundle = result.verdicts.find((v) => v.id === 'frontend.bundle.initial');
    const startup = result.verdicts.find((v) => v.id === 'flutter.startup.cold');
    expect(bundle?.status).toBe('pass'); // 250 <= 300 kb
    expect(startup?.status).toBe('fail'); // 4000 > 2500 ms
  });
});
