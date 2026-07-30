import { ApiProperty } from '@nestjs/swagger';

/**
 * Swagger response DTO for the admin Operations summary (P7.4). The platform's
 * internal types are plain interfaces; this class documents the headline shape
 * for `/docs`. The detailed telemetry endpoints (slo/alerts/incidents/health/
 * deployment/cost/reliability/report) return their typed interfaces directly
 * (documented via `@ApiOkResponse` descriptions), as the P7.3 ops surface does —
 * this surface is read-only and hidden from the product API contract.
 */

class SloTallyDto {
  @ApiProperty() total!: number;
  @ApiProperty() meeting!: number;
  @ApiProperty() atRisk!: number;
  @ApiProperty() breaching!: number;
}

class AlertTallyDto {
  @ApiProperty() firing!: number;
  @ApiProperty() suppressed!: number;
}

class DeploymentTallyDto {
  @ApiProperty() version!: string;
  @ApiProperty() successRate!: number;
  @ApiProperty() rollbacks!: number;
}

class ReliabilityTallyDto {
  @ApiProperty() availabilityRatio!: number;
  @ApiProperty({ nullable: true, type: Number }) mttrMinutes!: number | null;
}

/** Headline posture snapshot for the admin Operations dashboard. */
export class OperationsSummaryDto {
  @ApiProperty() generatedAt!: string;
  @ApiProperty({ enum: ['healthy', 'degraded', 'unhealthy'] })
  health!: 'healthy' | 'degraded' | 'unhealthy';
  @ApiProperty() ready!: boolean;
  @ApiProperty({ type: SloTallyDto }) slo!: SloTallyDto;
  @ApiProperty({ type: AlertTallyDto }) alerts!: AlertTallyDto;
  @ApiProperty({ type: () => Object }) incidents!: { open: number };
  @ApiProperty({ type: DeploymentTallyDto }) deployment!: DeploymentTallyDto;
  @ApiProperty({ type: ReliabilityTallyDto }) reliability!: ReliabilityTallyDto;
  @ApiProperty() costDailyUsd!: number;
  @ApiProperty() centralized!: boolean;
  @ApiProperty({ type: [String] }) controls!: string[];
}
