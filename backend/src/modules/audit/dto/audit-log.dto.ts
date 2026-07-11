import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

import { OffsetPaginationDto } from '../../../common/dto/offset-pagination.dto';

/**
 * Query for a user's audit trail. Extends the shared offset DTO (admin table,
 * docs 05 §5.2). `action` is a comma-separated filter kept as a string and split
 * in the service — the backend convention for multi-value query params.
 */
export class AuditQueryDto extends OffsetPaginationDto {
  @ApiPropertyOptional({
    description: 'Comma-separated action codes to include (e.g. "user.suspend,user.role_change").',
    example: 'user.suspend,user.unsuspend',
  })
  @IsOptional()
  @IsString()
  action?: string;
}

/** One audit-trail entry as returned by `GET /admin/users/:id/audit`. */
export class AuditLogDto {
  @ApiProperty({ example: '0198c9a1-7e2b-7cc3-9f1a-2b4d8e6f0a11' }) id!: string;
  @ApiProperty({ example: 'user.suspend', description: 'Dot-cased action code.' }) action!: string;
  @ApiProperty({
    example: 'status',
    description: 'UI grouping: status | role | security | administrative.',
  })
  category!: string;
  @ApiProperty({ nullable: true, description: 'Admin who performed the action.' })
  actorId!: string | null;
  @ApiProperty({ nullable: true }) actorRole!: string | null;
  @ApiProperty({ nullable: true, description: 'Affected entity id.' }) targetId!: string | null;
  @ApiProperty({ example: 'user' }) targetType!: string;
  @ApiProperty({ type: 'object', additionalProperties: true, description: 'Structured context.' })
  metadata!: Record<string, unknown>;
  @ApiProperty({ nullable: true }) ip!: string | null;
  @ApiProperty({ nullable: true }) requestId!: string | null;
  @ApiProperty({ example: '2026-07-10T09:12:00.000Z' }) createdAt!: string;
}

/** Aggregate summary of a user's audit trail (`auditSummary` in the detail view). */
export class AuditSummaryDto {
  @ApiProperty({ description: 'Total audit entries recorded against the user.' })
  totalEvents!: number;
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    description: 'Event count keyed by action code.',
  })
  byAction!: Record<string, number>;
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    description: 'Event count keyed by category (status/role/security/administrative).',
  })
  byCategory!: Record<string, number>;
  @ApiProperty({ nullable: true, description: 'Timestamp of the most recent action.' })
  lastActionAt!: string | null;
}
