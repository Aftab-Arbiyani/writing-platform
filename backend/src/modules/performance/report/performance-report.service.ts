import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { CacheService } from '../../../infrastructure/cache/cache.service';
import { deploymentConfig } from '../../../config/deployment.config';
import { PerformanceAnalysisService } from '../analysis/performance-analysis.service';
import { PerformanceBudgetService } from '../budgets/performance-budget.service';
import { CapacityPlanningService } from '../capacity/capacity-planning.service';
import { BenchmarkService } from '../benchmark/benchmark.service';
import { PERF_REDIS, PERF_SNAPSHOT_TTL_SECONDS } from '../performance.constants';
import { nowIso } from '../performance.util';
import type { BudgetVerification, PerformanceReport } from '../performance.types';

/**
 * Performance Report Generator (P7.3) — assembles the analysis, budget
 * verification, capacity plan, and last benchmark run into ONE
 * {@link PerformanceReport}, derives an overall health grade from the budget
 * verdicts, and persists the snapshot to Redis (ephemeral ops telemetry, DB 0)
 * so the admin surface and a future durable-history seam can read it. It
 * composes the platform's services; it computes nothing itself beyond the health
 * grade.
 */
@Injectable()
export class PerformanceReportService {
  private readonly logger = new Logger(PerformanceReportService.name);

  constructor(
    private readonly analysis: PerformanceAnalysisService,
    private readonly budgets: PerformanceBudgetService,
    private readonly capacity: CapacityPlanningService,
    private readonly benchmarks: BenchmarkService,
    private readonly cache: CacheService,
    @Inject(deploymentConfig.KEY) private readonly deployment: ConfigType<typeof deploymentConfig>,
  ) {}

  /** Build the full report (and persist the snapshot, best-effort). */
  async generate(): Promise<PerformanceReport> {
    const analysis = this.analysis.analyze();
    const budgets = this.budgets.verify(analysis);
    const capacity = await this.capacity.plan();

    const report: PerformanceReport = {
      generatedAt: nowIso(),
      environment: this.deployment.environment,
      version: this.deployment.version,
      analysis,
      budgets,
      capacity,
      benchmarks: this.benchmarks.latest(),
      health: gradeHealth(budgets),
    };

    await this.persist(report);
    return report;
  }

  /** The last persisted report snapshot, if any (survives across scrapes). */
  async lastSnapshot(): Promise<PerformanceReport | null> {
    return this.cache.get<PerformanceReport>(PERF_REDIS.reportSnapshot);
  }

  private async persist(report: PerformanceReport): Promise<void> {
    try {
      await this.cache.set(PERF_REDIS.reportSnapshot, report, PERF_SNAPSHOT_TTL_SECONDS);
    } catch (error) {
      this.logger.warn(`report snapshot persist failed: ${(error as Error).message}`);
    }
  }
}

/**
 * Overall health from budget verdicts: any failure on a runtime/API budget is
 * serious. healthy = no failures; degraded = 1–2 failures; unhealthy = 3+.
 * `not_measured` never counts against health.
 */
export function gradeHealth(budgets: BudgetVerification): PerformanceReport['health'] {
  if (budgets.failed === 0) {
    return 'healthy';
  }
  return budgets.failed <= 2 ? 'degraded' : 'unhealthy';
}
