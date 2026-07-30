import { Injectable } from '@nestjs/common';

import { PerformanceAnalysisService } from './analysis/performance-analysis.service';
import { PerformanceBudgetService } from './budgets/performance-budget.service';
import { CapacityPlanningService } from './capacity/capacity-planning.service';
import { BenchmarkService } from './benchmark/benchmark.service';
import { PerformanceReportService } from './report/performance-report.service';
import { PerformanceVerificationService } from './verification/performance-verification.service';
import { gradeHealth } from './report/performance-report.service';
import { nowIso } from './performance.util';

/** Non-secret posture snapshot for the admin performance dashboard. */
export interface PerformancePlatformStatus {
  readonly generatedAt: string;
  readonly health: 'healthy' | 'degraded' | 'unhealthy';
  readonly budgets: { total: number; passed: number; failed: number; notMeasured: number };
  readonly latencyP95Ms: number;
  readonly errorRatePercent: number;
  readonly cacheHitRatio: number;
  readonly eventLoopLagP95Ms: number;
  readonly heapUsedBytes: number;
  readonly scalingRecommendations: readonly string[];
  /** The cross-cutting controls the platform provides (audit/report language). */
  readonly controls: readonly string[];
}

/**
 * Performance Platform facade (P7.3) — the single injectable through which the
 * platform's capabilities are reached, and the SINGLE SOURCE OF TRUTH for
 * performance analysis. It aggregates the analysis, budget, capacity, benchmark,
 * verification, and report services behind one surface and exposes a posture
 * snapshot for the admin dashboard. It ORCHESTRATES those services; it never
 * re-implements analysis, and business services never carry optimization logic —
 * they emit samples through the observer seam and the platform does the rest.
 */
@Injectable()
export class PerformancePlatformService {
  constructor(
    readonly analysis: PerformanceAnalysisService,
    readonly budgets: PerformanceBudgetService,
    readonly capacity: CapacityPlanningService,
    readonly benchmarks: BenchmarkService,
    readonly verification: PerformanceVerificationService,
    readonly report: PerformanceReportService,
  ) {}

  /** Posture snapshot — safe for admins (no secrets, aggregate signals only). */
  async status(): Promise<PerformancePlatformStatus> {
    const analysis = this.analysis.analyze();
    const budgets = this.budgets.verify(analysis);
    const plan = await this.capacity.plan();
    return {
      generatedAt: nowIso(),
      health: gradeHealth(budgets),
      budgets: {
        total: budgets.total,
        passed: budgets.passed,
        failed: budgets.failed,
        notMeasured: budgets.notMeasured,
      },
      latencyP95Ms: analysis.latency.byKind.http?.p95Ms ?? 0,
      errorRatePercent: analysis.throughput.byKind.http?.errorRatePercent ?? 0,
      cacheHitRatio: analysis.cache.hitRatio,
      eventLoopLagP95Ms: analysis.resource.eventLoopLagP95Ms,
      heapUsedBytes: analysis.resource.heapUsedBytes,
      scalingRecommendations: plan.scalingRecommendations,
      controls: [
        'centralized-performance-budgets',
        'latency-throughput-analysis',
        'resource-profiling',
        'capacity-planning',
        'deterministic-benchmarks',
        'budget-verification',
        'slow-query-detection',
        'cache-hit-ratio',
        'metrics-exposition',
        'performance-health-probe',
      ],
    };
  }
}
