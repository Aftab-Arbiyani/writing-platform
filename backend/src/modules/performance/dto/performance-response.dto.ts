import { ApiProperty } from '@nestjs/swagger';

/**
 * Swagger response DTOs for the admin performance surface (P7.3). The platform's
 * internal types are plain interfaces; these classes document the headline
 * shapes for `/docs`. Detailed telemetry endpoints (report/analysis/capacity)
 * return their typed interfaces directly (documented via `@ApiOkResponse`
 * descriptions) as the monitoring/system controllers do — this ops surface is
 * read-only and hidden from the product API contract.
 */

class BudgetTallyDto {
  @ApiProperty() total!: number;
  @ApiProperty() passed!: number;
  @ApiProperty() failed!: number;
  @ApiProperty() notMeasured!: number;
}

/** Headline posture snapshot for the admin performance dashboard. */
export class PerformanceSummaryDto {
  @ApiProperty() generatedAt!: string;
  @ApiProperty({ enum: ['healthy', 'degraded', 'unhealthy'] })
  health!: 'healthy' | 'degraded' | 'unhealthy';
  @ApiProperty({ type: BudgetTallyDto }) budgets!: BudgetTallyDto;
  @ApiProperty() latencyP95Ms!: number;
  @ApiProperty() errorRatePercent!: number;
  @ApiProperty() cacheHitRatio!: number;
  @ApiProperty() eventLoopLagP95Ms!: number;
  @ApiProperty() heapUsedBytes!: number;
  @ApiProperty({ type: [String] }) scalingRecommendations!: string[];
  @ApiProperty({ type: [String] }) controls!: string[];
}

/** One budget verdict (for the budgets endpoint). */
export class BudgetVerdictDto {
  @ApiProperty() id!: string;
  @ApiProperty() domain!: string;
  @ApiProperty() label!: string;
  @ApiProperty() metric!: string;
  @ApiProperty() target!: number;
  @ApiProperty() comparator!: string;
  @ApiProperty() unit!: string;
  @ApiProperty({ nullable: true, type: Number }) measured!: number | null;
  @ApiProperty({ enum: ['pass', 'fail', 'not_measured'] })
  status!: 'pass' | 'fail' | 'not_measured';
}

/** Budget verification result. */
export class BudgetVerificationDto {
  @ApiProperty() generatedAt!: string;
  @ApiProperty() total!: number;
  @ApiProperty() passed!: number;
  @ApiProperty() failed!: number;
  @ApiProperty() notMeasured!: number;
  @ApiProperty({ type: [BudgetVerdictDto] }) verdicts!: BudgetVerdictDto[];
}
