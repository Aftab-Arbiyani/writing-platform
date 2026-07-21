import { Global, Module } from '@nestjs/common';
import type { OnApplicationBootstrap, OnModuleInit } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import {
  registerPerformanceObserver,
  PERFORMANCE_OBSERVER,
} from '../../common/performance/performance-observer.port';
import { PerformanceRegistryService } from './collector/performance-registry.service';
import { LatencyAnalysisService } from './analysis/latency-analysis.service';
import { ThroughputAnalysisService } from './analysis/throughput-analysis.service';
import { PerformanceAnalysisService } from './analysis/performance-analysis.service';
import { ResourceProfilingService } from './profiling/resource-profiling.service';
import { PerformanceBudgetService } from './budgets/performance-budget.service';
import { PerformanceVerificationService } from './verification/performance-verification.service';
import { CapacityPlanningService } from './capacity/capacity-planning.service';
import { BenchmarkService } from './benchmark/benchmark.service';
import { PerformanceReportService } from './report/performance-report.service';
import { PerformancePlatformService } from './performance-platform.service';
import { PerformanceHealthIndicator } from './performance-health.indicator';
import { PerformanceAdminController } from './performance-admin.controller';

/**
 * The Performance & Scalability Platform (P7.3) — the central place for
 * performance analysis, benchmarking, budgets, capacity planning, resource
 * profiling, and verification. `@Global` so its facade + verification are
 * injectable anywhere (the health probe reads them) without re-importing.
 *
 * It COMPOSES existing platforms rather than replacing them: the global
 * `MetricsService`/`/metrics` (observability), `CacheService`/`RedisService`
 * (telemetry persistence + signals), the `QueueMonitorService` (backlog/worker
 * capacity), the TypeORM `DataSource` (connection capacity), and the config
 * platform (budget/capacity tunables). Business services carry NO optimization
 * or threshold logic — they emit samples through the single
 * `PERFORMANCE_OBSERVER` seam and the platform owns analysis/budgets/reporting
 * centrally. Nothing here is on a request's critical path.
 */
@Global()
@Module({
  imports: [TerminusModule],
  controllers: [PerformanceAdminController],
  providers: [
    PerformanceRegistryService,
    { provide: PERFORMANCE_OBSERVER, useExisting: PerformanceRegistryService },
    LatencyAnalysisService,
    ThroughputAnalysisService,
    ResourceProfilingService,
    PerformanceAnalysisService,
    PerformanceBudgetService,
    PerformanceVerificationService,
    CapacityPlanningService,
    BenchmarkService,
    PerformanceReportService,
    PerformancePlatformService,
    PerformanceHealthIndicator,
  ],
  exports: [
    PerformancePlatformService,
    PerformanceVerificationService,
    PerformanceBudgetService,
    PerformanceRegistryService,
    PerformanceHealthIndicator,
    PERFORMANCE_OBSERVER,
  ],
})
export class PerformanceModule implements OnModuleInit, OnApplicationBootstrap {
  constructor(
    private readonly registry: PerformanceRegistryService,
    private readonly resources: ResourceProfilingService,
  ) {}

  /** Wire the DI-less observer accessor so the TypeORM query logger + any
   * non-DI code feed the same registry the `PERFORMANCE_OBSERVER` token resolves
   * to (mirrors SecurityModule's `registerEncryptionService`). */
  onModuleInit(): void {
    registerPerformanceObserver(this.registry);
  }

  /** Record process startup time once the whole app has bootstrapped. */
  onApplicationBootstrap(): void {
    this.resources.markStartup(process.uptime() * 1000);
  }
}
