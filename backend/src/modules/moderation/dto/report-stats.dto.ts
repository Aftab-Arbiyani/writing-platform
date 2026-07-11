import { ApiProperty } from '@nestjs/swagger';

/** Per-moderator resolution performance. */
export class ModeratorPerformanceDto {
  @ApiProperty() moderatorId!: string;
  @ApiProperty() resolved!: number;
  @ApiProperty({ nullable: true, description: 'Mean seconds to resolve.' })
  avgSeconds!: number | null;
}

/** Report statistics (`GET /admin/reports/statistics`, E12.7). */
export class ReportStatisticsDto {
  @ApiProperty({ description: 'Pending + reviewing + appealed.' }) openReports!: number;
  @ApiProperty() resolvedReports!: number;
  @ApiProperty() dismissedReports!: number;
  @ApiProperty({ nullable: true, description: 'Mean seconds from report to resolution.' })
  avgResolutionSeconds!: number | null;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  byStatus!: Record<string, number>;
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    description: 'By reason.',
  })
  byCategory!: Record<string, number>;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  bySeverity!: Record<string, number>;
  @ApiProperty({ type: [ModeratorPerformanceDto] })
  moderatorPerformance!: ModeratorPerformanceDto[];
}

/** One day in the report trend series. */
export class ReportTrendPointDto {
  @ApiProperty({ example: '2026-07-10' }) date!: string;
  @ApiProperty() created!: number;
  @ApiProperty() resolved!: number;
}

/** Report trends over a window (`GET /admin/reports/trends`, E12.7). */
export class ReportTrendsDto {
  @ApiProperty() from!: string;
  @ApiProperty() to!: string;
  @ApiProperty({ type: [ReportTrendPointDto] }) points!: ReportTrendPointDto[];
}

/** One chronological entry in a report's timeline (action or note). */
export class ReportTimelineEntryDto {
  @ApiProperty({ enum: ['action', 'note'] }) kind!: 'action' | 'note';
  @ApiProperty() at!: string;
  @ApiProperty({ nullable: true }) action!: string | null;
  @ApiProperty({ nullable: true }) category!: string | null;
  @ApiProperty({ nullable: true }) actorId!: string | null;
  @ApiProperty({ nullable: true }) actorRole!: string | null;
  @ApiProperty({ nullable: true, description: 'Note body (note entries).' })
  body!: string | null;
  @ApiProperty({ nullable: true, description: 'Audit reference id (action entries).' })
  auditRef!: string | null;
  @ApiProperty({ type: 'object', additionalProperties: true })
  metadata!: Record<string, unknown>;
}
