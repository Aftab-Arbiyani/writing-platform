import type { ConfigType } from '@nestjs/config';

import type { performanceConfig } from '../../../config/performance.config';
import { PerformanceRegistryService } from '../collector/performance-registry.service';
import { readMetric } from '../performance.util';
import { LatencyAnalysisService } from './latency-analysis.service';
import { ThroughputAnalysisService } from './throughput-analysis.service';

function registry(): PerformanceRegistryService {
  const config = {
    enabled: true,
    slowQueryMs: 200,
    windowSeconds: 300,
    eventLoopSampleMs: 2000,
    benchmarkEnabled: true,
    benchmarkIterations: 100,
    capacity: { apiRps: 0, workers: 0, redisMemoryBytes: 0, aiTokensDaily: 0 },
  } as ConfigType<typeof performanceConfig>;
  return new PerformanceRegistryService(config);
}

describe('LatencyAnalysisService', () => {
  it('rolls up per-kind and ranks the slowest operations', () => {
    const reg = registry();
    reg.observe({ operation: 'GET /fast', kind: 'http', durationMs: 5, ok: true });
    reg.observe({ operation: 'GET /slow', kind: 'http', durationMs: 900, ok: true });
    reg.observe({ operation: 'search', kind: 'search', durationMs: 200, ok: true });
    const analysis = new LatencyAnalysisService(reg).analyze();
    expect(analysis.byKind.http).toBeDefined();
    expect(analysis.byKind.search).toBeDefined();
    expect(analysis.slowest[0]!.operation).toBe('GET /slow');
  });
});

describe('ThroughputAnalysisService', () => {
  it('computes per-kind counts, rps and error rate', () => {
    const reg = registry();
    for (let i = 0; i < 5; i += 1) {
      reg.observe({ operation: 'GET /x', kind: 'http', durationMs: 10, ok: i !== 0 });
    }
    const analysis = new ThroughputAnalysisService(reg).analyze();
    expect(analysis.totalOperations).toBe(5);
    expect(analysis.byKind.http?.count).toBe(5);
    expect(analysis.byKind.http?.errorRatePercent).toBe(20);
  });
});

describe('readMetric', () => {
  it('maps dot-path budget metrics onto the analysis (or null when absent)', () => {
    const reg = registry();
    reg.observe({ operation: 'GET /x', kind: 'http', durationMs: 100, ok: true });
    const analysis = {
      latency: new LatencyAnalysisService(reg).analyze(),
      throughput: new ThroughputAnalysisService(reg).analyze(),
      cache: { hits: 0, misses: 0, hitRatio: 1, p95Ms: 0 },
      resource: {
        uptimeSeconds: 1,
        startupMs: 2000,
        eventLoopLagMeanMs: 1,
        eventLoopLagP95Ms: 7,
        rssBytes: 1,
        heapUsedBytes: 123,
        heapTotalBytes: 1,
        externalBytes: 0,
        cpuPercent: 12,
        gcCount: 0,
        gcTotalMs: 0,
        activeHandles: 1,
      },
      slowQueries: [],
      generatedAt: '2026-07-21T00:00:00.000Z',
      windowSeconds: 300,
    };
    expect(readMetric(analysis, 'http.p95Ms')).toBe(100);
    expect(readMetric(analysis, 'resource.heapUsedBytes')).toBe(123);
    expect(readMetric(analysis, 'resource.eventLoopLagP95Ms')).toBe(7);
    // cache hit ratio is null until there is cache traffic
    expect(readMetric(analysis, 'cache.hitRatio')).toBeNull();
    // unknown / client-side metric
    expect(readMetric(analysis, 'frontend.initialJsKb')).toBeNull();
  });
});
