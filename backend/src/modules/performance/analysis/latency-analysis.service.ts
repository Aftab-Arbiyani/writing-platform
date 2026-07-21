import { Injectable } from '@nestjs/common';

import { PerformanceRegistryService } from '../collector/performance-registry.service';
import type { PerfOperationKind } from '../../../common/performance/performance-observer.port';
import type { LatencyAnalysis, LatencyStats, OperationStats } from '../performance.types';

const KINDS: readonly PerfOperationKind[] = [
  'http',
  'db',
  'cache',
  'queue',
  'search',
  'ai',
  'storage',
];
const SLOWEST_LIMIT = 10;

/**
 * Latency Analysis Service (P7.3) — turns the registry's raw reservoirs into
 * percentile analysis (p50/p95/p99) overall, per operation-kind, and a ranked
 * list of the slowest operations. Read-only over the registry; owns no state.
 */
@Injectable()
export class LatencyAnalysisService {
  constructor(private readonly registry: PerformanceRegistryService) {}

  analyze(): LatencyAnalysis {
    const overall = this.registry.aggregate();
    const byKind: Partial<Record<PerfOperationKind, LatencyStats>> = {};
    for (const kind of KINDS) {
      const stats = this.registry.aggregate((k) => k === kind);
      if (stats.count > 0) {
        byKind[kind] = stats;
      }
    }
    const slowest: OperationStats[] = this.registry
      .operationStats()
      .filter((o) => o.count > 0)
      .sort((a, b) => b.p95Ms - a.p95Ms)
      .slice(0, SLOWEST_LIMIT);
    return { overall, byKind, slowest };
  }

  /** p95 latency for a kind (0 if none), used by budget verification. */
  p95ForKind(kind: PerfOperationKind): number {
    return this.registry.aggregate((k) => k === kind).p95Ms;
  }
}
