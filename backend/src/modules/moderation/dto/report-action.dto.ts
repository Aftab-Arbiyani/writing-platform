import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportPriority, ReportResolution, ReportSeverity } from '@qalam/shared';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Max ids per bulk moderation call (mirrors the admin-users bulk cap). */
export const BULK_REPORT_MAX = 200;

/** The bulk operations exposed by `POST /admin/reports/bulk-actions`. */
export const BULK_REPORT_ACTIONS = [
  'approve',
  'reject',
  'assign',
  'hide',
  'restore',
  'close',
] as const;
export type BulkReportAction = (typeof BULK_REPORT_ACTIONS)[number];

/** Body for `POST /admin/reports/:id/resolve`. The resolution drives the content/user action. */
export class ResolveReportDto {
  @ApiProperty({ enum: Object.values(ReportResolution), example: ReportResolution.ContentHidden })
  @IsEnum(ReportResolution)
  resolution!: ReportResolution;

  @ApiPropertyOptional({ maxLength: 1000, description: 'Moderator rationale (audited).' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @ApiPropertyOptional({ enum: Object.values(ReportSeverity), description: 'Assessed severity.' })
  @IsOptional()
  @IsEnum(ReportSeverity)
  severity?: ReportSeverity;
}

/** Body for `POST /admin/reports/:id/assign`. */
export class AssignModeratorDto {
  @ApiProperty({ format: 'uuid', description: 'Moderator to assign the report to.' })
  @IsUUID()
  moderatorId!: string;
}

/** Body for `PATCH /admin/reports/:id/priority`. */
export class UpdatePriorityDto {
  @ApiProperty({ enum: Object.values(ReportPriority) })
  @IsEnum(ReportPriority)
  priority!: ReportPriority;
}

/** Body for `POST /admin/reports/:id/notes`. */
export class AddNoteDto {
  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}

/** Body for `POST /admin/reports/bulk-actions`. */
export class BulkReportActionDto {
  @ApiProperty({ enum: BULK_REPORT_ACTIONS })
  @IsIn(BULK_REPORT_ACTIONS)
  action!: BulkReportAction;

  @ApiProperty({ type: [String], format: 'uuid', maxItems: BULK_REPORT_MAX })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(BULK_REPORT_MAX)
  @IsUUID('all', { each: true })
  reportIds!: string[];

  @ApiPropertyOptional({ format: 'uuid', description: 'Required when `action` is `assign`.' })
  @IsOptional()
  @IsUUID()
  moderatorId?: string;

  @ApiPropertyOptional({
    maxLength: 1000,
    description: 'Rationale recorded on each report (audited).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
