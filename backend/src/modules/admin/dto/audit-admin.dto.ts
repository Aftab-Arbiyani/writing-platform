import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';

import { OffsetPaginationDto } from '../../../common/dto/offset-pagination.dto';

/**
 * Query for `GET /admin/audit-logs` (E12.7) — the global audit browser. Offset
 * pagination + filters over the append-only `audit_logs` table. `module` matches
 * the action prefix (e.g. `user`, `report`, `content`); `sort` = `createdAt|action`
 * with a `-` prefix for descending.
 */
export class AdminAuditQueryDto extends OffsetPaginationDto {
  @ApiPropertyOptional({ description: 'Exact action code, e.g. "user.suspend".' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ description: 'Module (action prefix), e.g. "report".' })
  @IsOptional()
  @IsString()
  module?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by actor.' })
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiPropertyOptional({ description: 'Target entity kind, e.g. "report", "user".' })
  @IsOptional()
  @IsString()
  targetType?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by target id.' })
  @IsOptional()
  @IsUUID()
  targetId?: string;

  @ApiPropertyOptional({ description: 'On/after (ISO 8601).' })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'On/before (ISO 8601).' })
  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Search the action, or an exact actor/target id.' })
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

/** Query for `GET /admin/audit-logs/export` — the audit filters plus a format. */
export class AuditExportQueryDto extends AdminAuditQueryDto {
  @ApiPropertyOptional({ enum: ['csv', 'json'], default: 'csv' })
  @IsOptional()
  @IsIn(['csv', 'json'])
  format: 'csv' | 'json' = 'csv';
}
