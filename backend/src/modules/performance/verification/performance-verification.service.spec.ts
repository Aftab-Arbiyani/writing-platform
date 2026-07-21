import type { PerformanceAnalysisService } from '../analysis/performance-analysis.service';
import { PerformanceBudgetService } from '../budgets/performance-budget.service';
import type { PerformanceAnalysis } from '../performance.types';
import { PerformanceVerificationService } from './performance-verification.service';

function analysis(httpP95: number): PerformanceAnalysis {
  const stats = {
    count: 10,
    errorCount: 0,
    minMs: 1,
    meanMs: 5,
    p50Ms: 5,
    p95Ms: httpP95,
    p99Ms: httpP95,
    maxMs: httpP95,
  };
  return {
    generatedAt: '2026-07-21T00:00:00.000Z',
    windowSeconds: 300,
    latency: { overall: stats, byKind: { http: stats }, slowest: [] },
    throughput: {
      windowSeconds: 300,
      totalOperations: 10,
      operationsPerSecond: 0.03,
      errorRatePercent: 0,
      byKind: { http: { count: 10, rps: 0.03, errorRatePercent: 0 } },
      busiest: [],
    },
    cache: { hits: 0, misses: 0, hitRatio: 1, p95Ms: 0 },
    resource: {
      uptimeSeconds: 10,
      startupMs: 2000,
      eventLoopLagMeanMs: 1,
      eventLoopLagP95Ms: 5,
      rssBytes: 1,
      heapUsedBytes: 1,
      heapTotalBytes: 1,
      externalBytes: 0,
      cpuPercent: 10,
      gcCount: 0,
      gcTotalMs: 0,
      activeHandles: 1,
    },
    slowQueries: [],
  };
}

function build(httpP95: number) {
  const analysisService = {
    analyze: jest.fn().mockReturnValue(analysis(httpP95)),
  } as unknown as PerformanceAnalysisService;
  const service = new PerformanceVerificationService(
    analysisService,
    new PerformanceBudgetService(),
  );
  return service;
}

describe('PerformanceVerificationService', () => {
  it('is ok with no violations when all server-measured budgets pass', () => {
    const outcome = build(100).verify();
    expect(outcome.ok).toBe(true);
    expect(outcome.violations).toHaveLength(0);
  });

  it('reports the violating budget when a budget is breached', () => {
    const outcome = build(5000).verify();
    expect(outcome.ok).toBe(false);
    expect(outcome.violations.map((v) => v.id)).toContain('api.latency.p95');
  });

  it('is deterministic — same telemetry yields the same outcome', () => {
    const a = build(100).verify();
    const b = build(100).verify();
    expect(a).toEqual(b);
  });

  it('verifyExternal flags client-budget breaches', () => {
    const outcome = build(100).verifyExternal({ 'frontend.bundle.initial': 900 });
    expect(outcome.ok).toBe(false);
    expect(outcome.violations.map((v) => v.id)).toContain('frontend.bundle.initial');
  });
});
