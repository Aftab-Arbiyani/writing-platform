import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { ADMIN_BULK_MAX } from '../admin.constants';

/** Supported bulk operations (E12.5). `activate` normalizes status to active. */
export const BULK_USER_ACTIONS = [
  'verify',
  'suspend',
  'activate',
  'deactivate',
  'force_logout',
  'export',
] as const;
export type BulkUserAction = (typeof BULK_USER_ACTIONS)[number];

/**
 * Bulk user operation (`POST /admin/users/bulk-actions`). Processed
 * synchronously over a bounded id set (≤ ADMIN_BULK_MAX) — Qalam has no existing
 * admin-job queue, so per-item results are returned inline (partial success is
 * expected and reported, never all-or-nothing).
 */
export class BulkUserActionDto {
  @ApiProperty({ enum: BULK_USER_ACTIONS, description: 'The operation to apply to every id.' })
  @IsIn(BULK_USER_ACTIONS)
  action!: BulkUserAction;

  @ApiProperty({
    type: [String],
    description: `Target user ids (1–${ADMIN_BULK_MAX}).`,
    example: ['0198c9a1-7e2b-7cc3-9f1a-2b4d8e6f0a11'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(ADMIN_BULK_MAX)
  @IsUUID('7', { each: true })
  userIds!: string[];

  @ApiPropertyOptional({ description: 'Reason recorded in the audit trail.', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/** One failed id in a bulk run. */
export class BulkActionFailureDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'CONFLICT' }) code!: string;
  @ApiProperty() message!: string;
}

/** Outcome of a bulk operation — per-item success/failure, plus export payload. */
export class BulkActionResultDto {
  @ApiProperty({ example: 'suspend' }) action!: string;
  @ApiProperty({ description: 'Ids submitted.' }) requested!: number;
  @ApiProperty({ type: [String], description: 'Ids that succeeded.' }) succeeded!: string[];
  @ApiProperty({ type: [BulkActionFailureDto], description: 'Ids that failed, with reasons.' })
  failed!: BulkActionFailureDto[];
  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    description: 'Exported rows (present only when action = "export").',
  })
  data?: Record<string, unknown>[];
}
