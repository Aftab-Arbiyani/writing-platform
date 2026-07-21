import { Injectable } from '@nestjs/common';

import { PerformanceRegistryService } from '../collector/performance-registry.service';
import { LatencyAnalysisService } from './latency-analysis.service';
import { ThroughputAnalysisService } from './throughput-analysis.service';
import { ResourceProfilingService } from '../profiling/resource-profiling.service';
import { nowIso } from '../performance.util';
import type { CacheAnalysis, PerformanceAnalysis, SlowQueryRecord } from '../performance.types';

const SLOW_QUERY_REPORT_LIMIT = 20;

/**
 * Performance Analysis Service (P7.3) — the umbrella that composes the latency,
 * throughput, cache, resource, and slow-query surfaces into ONE
 * {@link PerformanceAnalysis} snapshot. This is the single object every consumer
 * (budgets, capacity, report, admin, health) reads, so analysis is computed
 * once and never duplicated.
 */
@Injectable()
export class PerformanceAnalysisService {
  constructor(
    private readonly registry: PerformanceRegistryService,
    private readonly latency: LatencyAnalysisService,
    private readonly throughput: ThroughputAnalysisService,
    private readonly resource: ResourceProfilingService,
  ) {}

  analyze(): PerformanceAnalysis {
    const cacheStats = this.registry.cacheStats();
    const cache: CacheAnalysis = {
      hits: cacheStats.hits,
      misses: cacheStats.misses,
      hitRatio: round4(cacheStats.hitRatio),
      p95Ms: cacheStats.p95Ms,
    };
    const slow = this.registry.slowQuerySnapshot();
    const slowQueries: SlowQueryRecord[] = slow.recent
      .slice()
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, SLOW_QUERY_REPORT_LIMIT)
      .map((q) => ({ sql: q.sql, durationMs: round2(q.durationMs) }));

    return {
      generatedAt: nowIso(),
      windowSeconds: this.registry.collectionSeconds(),
      latency: this.latency.analyze(),
      throughput: this.throughput.analyze(),
      cache,
      resource: this.resource.snapshot(),
      slowQueries,
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
