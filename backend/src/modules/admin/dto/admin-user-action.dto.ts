import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Optional body for the account-action endpoints (suspend / deactivate /
 * reset-password / force-logout). The reason is persisted in the audit trail
 * (docs 13 §11); the body may be omitted entirely.
 */
export class AdminActionReasonDto {
  @ApiPropertyOptional({ description: 'Reason for the action (recorded in the audit log).' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
