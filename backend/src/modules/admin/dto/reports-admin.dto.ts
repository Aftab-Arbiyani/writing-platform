import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportPriority, ReportResolution, ReportSeverity, ReportStatus } from '@qalam/shared';
import {
  IsEnum,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

import { ReportFilterDto } from '../../moderation/dto/report-filter.dto';

/**
 * Body for `PATCH /admin/reports/:id` (E12.7). Every field is optional; the
 * controller orchestrates the existing ModerationService methods for whichever
 * are supplied (assign → priority → reopen/resolve). Resolve/Close are expressed
 * via `resolution`; Reopen via `status: reviewing`.
 */
export class UpdateReportDto {
  @ApiPropertyOptional({ enum: Object.values(ReportStatus), description: 'reviewing → reopen.' })
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @ApiPropertyOptional({ enum: Object.values(ReportPriority) })
  @IsOptional()
  @IsEnum(ReportPriority)
  priority?: ReportPriority;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  assignedModeratorId?: string;

  @ApiPropertyOptional({ enum: Object.values(ReportResolution), description: 'Resolve/Close.' })
  @IsOptional()
  @IsEnum(ReportResolution)
  resolution?: ReportResolution;

  @ApiPropertyOptional({ enum: Object.values(ReportSeverity) })
  @IsOptional()
  @IsEnum(ReportSeverity)
  severity?: ReportSeverity;

  @ApiPropertyOptional({ maxLength: 1000, description: 'Rationale (audited).' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

/** Body for `PATCH /admin/reports/:id/notes/:noteId`. */
export class UpdateNoteDto {
  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}

/** Query for `GET /admin/reports/trends` — defaults to the last 30 days if omitted. */
export class TrendsQueryDto {
  @ApiPropertyOptional({ description: 'From (ISO 8601).' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'To (ISO 8601).' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}

/** Query for `GET /admin/reports/export` — the report filters plus a format. */
export class ReportExportQueryDto extends ReportFilterDto {
  @ApiPropertyOptional({ enum: ['csv', 'json'], default: 'csv' })
  @IsOptional()
  @IsIn(['csv', 'json'])
  format: 'csv' | 'json' = 'csv';
}
