import { Injectable } from '@nestjs/common';

import { PerformanceRegistryService } from '../collector/performance-registry.service';
import type { PerfOperationKind } from '../../../common/performance/performance-observer.port';
import type { ThroughputAnalysis } from '../performance.types';

const BUSIEST_LIMIT = 10;

/**
 * Throughput Analysis Service (P7.3) — derives operations/sec and error rate
 * (overall, per kind, and the busiest operations) from the registry counters
 * over the collection window. Read-only; owns no state.
 */
@Injectable()
export class ThroughputAnalysisService {
  constructor(private readonly registry: PerformanceRegistryService) {}

  analyze(): ThroughputAnalysis {
    const windowSeconds = this.registry.collectionSeconds();
    const ops = this.registry.operationStats();

    let total = 0;
    let errors = 0;
    const byKind: Partial<Record<PerfOperationKind, { count: number; errors: number }>> = {};
    for (const o of ops) {
      total += o.count;
      errors += o.errorCount;
      const acc = byKind[o.kind] ?? { count: 0, errors: 0 };
      acc.count += o.count;
      acc.errors += o.errorCount;
      byKind[o.kind] = acc;
    }

    const byKindOut: ThroughputAnalysis['byKind'] = {};
    for (const kind of Object.keys(byKind) as PerfOperationKind[]) {
      const v = byKind[kind];
      if (v === undefined) {
        continue;
      }
      byKindOut[kind] = {
        count: v.count,
        rps: round2(v.count / windowSeconds),
        errorRatePercent: v.count === 0 ? 0 : round2((v.errors / v.count) * 100),
      };
    }

    const busiest = ops
      .slice()
      .sort((a, b) => b.count - a.count)
      .slice(0, BUSIEST_LIMIT)
      .map((o) => ({
        operation: o.operation,
        count: o.count,
        rps: round2(o.count / windowSeconds),
      }));

    return {
      windowSeconds,
      totalOperations: total,
      operationsPerSecond: round2(total / windowSeconds),
      errorRatePercent: total === 0 ? 0 : round2((errors / total) * 100),
      byKind: byKindOut,
      busiest,
    };
  }

  /** Aggregate 5xx/error rate (%) across all HTTP operations. */
  httpErrorRatePercent(): number {
    const http = this.registry.aggregate((k) => k === 'http');
    return http.count === 0 ? 0 : round2((http.errorCount / http.count) * 100);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
