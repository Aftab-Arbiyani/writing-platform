import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@qalam/shared';

import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { Permissions } from '../permissions/permissions.decorator';
import { PerformancePlatformService } from './performance-platform.service';
import type { PerformancePlatformStatus } from './performance-platform.service';
import { PerformanceReportService } from './report/performance-report.service';
import { BenchmarkService } from './benchmark/benchmark.service';
import { ResourceProfilingService } from './profiling/resource-profiling.service';
import { PerformanceSummaryDto, BudgetVerificationDto } from './dto/performance-response.dto';
import type {
  BenchmarkRun,
  BudgetVerification,
  CapacityPlan,
  PerformanceAnalysis,
  PerformanceReport,
  ResourceProfile,
} from './performance.types';

/**
 * Admin performance surface (P7.3) — feeds the admin Performance dashboard with
 * the platform's read-only summaries + reports. Admin-gated
 * (`admin.dashboard`); the global JwtAuthGuard authenticates. All endpoints are
 * read-only observability views (no dashboards/alerting here — those are P7.4);
 * benchmark EXECUTION is the CLI `backend/perf/run-benchmarks.ts` (repeatable,
 * CI-gated), so this surface only reads the last run — it never runs load on the
 * request path.
 */
@ApiTags('admin-performance')
@ApiBearerAuth()
@Controller('admin/performance')
@UseGuards(RateLimitGuard)
export class PerformanceAdminController {
  constructor(
    private readonly platform: PerformancePlatformService,
    private readonly report: PerformanceReportService,
    private readonly benchmarks: BenchmarkService,
    private readonly resources: ResourceProfilingService,
  ) {}

  @Get('summary')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({
    summary: 'Performance Platform posture (health, budget tally, headline signals).',
  })
  @ApiOkResponse({ type: PerformanceSummaryDto })
  summary(): Promise<PerformancePlatformStatus> {
    return this.platform.status();
  }

  @Get('budgets')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({ summary: 'Live performance-budget verification (pass/fail per budget).' })
  @ApiOkResponse({ type: BudgetVerificationDto })
  budgets(): BudgetVerification {
    return this.platform.budgets.verify(this.platform.analysis.analyze());
  }

  @Get('analysis')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({ summary: 'Latency + throughput + cache + slow-query analysis snapshot.' })
  @ApiOkResponse({ description: 'PerformanceAnalysis snapshot.' })
  analysis(): PerformanceAnalysis {
    return this.platform.analysis.analyze();
  }

  @Get('resources')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({ summary: 'Process resource profile (event loop, memory, CPU, GC).' })
  @ApiOkResponse({ description: 'ResourceProfile snapshot.' })
  resourceUsage(): ResourceProfile {
    return this.resources.snapshot();
  }

  @Get('capacity')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({ summary: 'Capacity plan — forecasts + scaling recommendations.' })
  @ApiOkResponse({ description: 'CapacityPlan snapshot.' })
  capacity(): Promise<CapacityPlan> {
    return this.platform.capacity.plan();
  }

  @Get('benchmarks')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({ summary: 'Last deterministic benchmark run (null until one has been executed).' })
  @ApiOkResponse({ description: 'BenchmarkRun or null.' })
  benchmarkResults(): BenchmarkRun | null {
    return this.benchmarks.latest();
  }

  @Get('report')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({
    summary:
      'Full performance report (analysis + budgets + capacity + benchmarks); persists a snapshot.',
  })
  @ApiOkResponse({ description: 'PerformanceReport.' })
  fullReport(): Promise<PerformanceReport> {
    return this.report.generate();
  }
}
