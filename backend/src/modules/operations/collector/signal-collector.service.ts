import { Injectable, Logger } from '@nestjs/common';

import { QueueMonitorService } from '../../../infrastructure/monitoring/queue-monitor.service';
import { PerformancePlatformService } from '../../performance/performance-platform.service';
import { PerformanceRegistryService } from '../../performance/collector/performance-registry.service';
import { CostObservabilityService } from '../cost/cost-observability.service';
import { OperationsRegistryService } from './operations-registry.service';
import type { OperationalSignals } from '../operations.types';
import { round2, round4 } from '../operations.util';

/**
 * Assembles the resolved {@link OperationalSignals} snapshot ONCE per read, from
 * the platforms that ALREADY measure each signal — the P7.3 Performance Platform
 * (latency / error-rate / cache / slow-queries / resource / capacity), the queue
 * monitor (backlog age), the cost estimate, and the ops registry (security /
 * failure counters). This is the "reuse, no duplicated monitoring" boundary made
 * concrete: the SLO + alert rules read this snapshot; nothing here re-measures.
 *
 * Per-service latency (ai / search / payments) is derived by filtering the
 * Performance registry's per-operation read model by route prefix — those calls
 * flow as HTTP operations, so their latency is already measured; we just project
 * it, we do not instrument a second time.
 */
@Injectable()
export class SignalCollectorService {
  private readonly logger = new Logger(SignalCollectorService.name);

  constructor(
    private readonly performance: PerformancePlatformService,
    private readonly perfRegistry: PerformanceRegistryService,
    private readonly queues: QueueMonitorService,
    private readonly cost: CostObservabilityService,
    private readonly registry: OperationsRegistryService,
  ) {}

  async collect(): Promise<OperationalSignals> {
    const analysis = this.performance.analysis.analyze();
    const http = analysis.latency.byKind.http ?? null;
    const httpThroughput = analysis.throughput.byKind.http ?? null;
    const hasHttp = (httpThroughput?.count ?? 0) > 0;
    const errorRate = httpThroughput?.errorRatePercent ?? null;

    const [plan, oldestWaitingSeconds, costDaily] = await Promise.all([
      this.performance.capacity.plan(),
      this.oldestWaitingSeconds(),
      this.safeDailyCost(),
    ]);

    const ai = this.byRoute(['/ai', '/story-intelligence', '/retrieval']);
    const search = this.byRoute(['/search']);
    const payments = this.byRoute(['/billing', '/subscriptions', '/purchases', '/payment']);
    const cache = analysis.cache.hits + analysis.cache.misses > 0 ? analysis.cache.hitRatio : null;

    return {
      api: {
        p95Ms: http?.p95Ms ?? null,
        p99Ms: http?.p99Ms ?? null,
        errorRatePercent: errorRate,
        availability: hasHttp && errorRate !== null ? round4(1 - errorRate / 100) : null,
        successRate: hasHttp && errorRate !== null ? round4(1 - errorRate / 100) : null,
      },
      ai: {
        p95Ms: ai.p95Ms,
        availability: ai.availability,
      },
      search: { p95Ms: search.p95Ms },
      payments: { p95Ms: payments.p95Ms, successRate: payments.availability },
      cache: { hitRatio: cache === null ? null : round4(cache) },
      db: { slowQueryCount: analysis.slowQueries.length },
      runtime: {
        eventLoopLagP95Ms: analysis.resource.eventLoopLagP95Ms,
        heapUsedBytes: analysis.resource.heapUsedBytes,
        cpuPercent: analysis.resource.cpuPercent,
      },
      queue: { oldestWaitingSeconds },
      capacity: { shouldScaleCount: plan.forecasts.filter((f) => f.shouldScale).length },
      security: { eventRatePerMin: this.registry.ratePerMinute('security.event') },
      cost: { dailyUsd: costDaily },
    };
  }

  /**
   * Project per-service latency + availability from the Performance registry's
   * per-operation read model by matching route prefixes (reuse, not re-measure).
   */
  private byRoute(prefixes: readonly string[]): {
    p95Ms: number | null;
    availability: number | null;
  } {
    const ops = this.perfRegistry
      .operationStats()
      .filter((o) => o.kind === 'http' && prefixes.some((p) => o.operation.includes(p)));
    if (ops.length === 0) {
      return { p95Ms: null, availability: null };
    }
    const p95Ms = Math.max(...ops.map((o) => o.p95Ms));
    const count = ops.reduce((s, o) => s + o.count, 0);
    const errors = ops.reduce((s, o) => s + o.errorCount, 0);
    const availability = count > 0 ? round4(1 - errors / count) : null;
    return { p95Ms: round2(p95Ms), availability };
  }

  private async oldestWaitingSeconds(): Promise<number | null> {
    try {
      const queues = await this.queues.listQueues();
      if (queues.length === 0) {
        return null;
      }
      const oldestMs = Math.max(...queues.map((q) => q.oldestWaitingAgeMs));
      return Math.round(oldestMs / 1000);
    } catch (error) {
      this.logger.warn(`queue backlog signal unavailable: ${(error as Error).message}`);
      return null;
    }
  }

  private async safeDailyCost(): Promise<number> {
    try {
      return await this.cost.dailyUsd();
    } catch (error) {
      this.logger.warn(`cost signal unavailable: ${(error as Error).message}`);
      return 0;
    }
  }
}
