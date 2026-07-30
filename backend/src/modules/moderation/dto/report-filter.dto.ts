import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ReportEntityType,
  ReportPriority,
  ReportReason,
  ReportSeverity,
  ReportStatus,
} from '@qalam/shared';
import { IsEnum, IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';

import { OffsetPaginationDto } from '../../../common/dto/offset-pagination.dto';

/**
 * Query for `GET /admin/reports` — offset-paginated queue with triage filters
 * (docs 05 §5.2, §6). `sort` accepts `createdAt|priority|severity|status`, a `-`
 * prefix for descending (whitelisted in the repository).
 */
export class ReportFilterDto extends OffsetPaginationDto {
  @ApiPropertyOptional({ enum: Object.values(ReportEntityType) })
  @IsOptional()
  @IsEnum(ReportEntityType)
  type?: ReportEntityType;

  @ApiPropertyOptional({ enum: Object.values(ReportStatus) })
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @ApiPropertyOptional({ enum: Object.values(ReportPriority) })
  @IsOptional()
  @IsEnum(ReportPriority)
  priority?: ReportPriority;

  @ApiPropertyOptional({ enum: Object.values(ReportSeverity) })
  @IsOptional()
  @IsEnum(ReportSeverity)
  severity?: ReportSeverity;

  @ApiPropertyOptional({ enum: Object.values(ReportReason) })
  @IsOptional()
  @IsEnum(ReportReason)
  reason?: ReportReason;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by assigned moderator.' })
  @IsOptional()
  @IsUUID()
  assignedModeratorId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by the reported user.' })
  @IsOptional()
  @IsUUID()
  reportedUserId?: string;

  @ApiPropertyOptional({ description: 'Reported on/after (ISO 8601).' })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Reported on/before (ISO 8601).' })
  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Search the description, or an exact reporter/target/user id.',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Sort field; `-` prefix = descending.',
    default: '-createdAt',
  })
  @IsOptional()
  @IsString()
  sort?: string;
}
