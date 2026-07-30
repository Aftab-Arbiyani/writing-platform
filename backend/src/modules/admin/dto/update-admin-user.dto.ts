import { ApiPropertyOptional } from '@nestjs/swagger';
import { PEN_NAME_MAX, Role, UserStatus } from '@qalam/shared';
import { IsBoolean, IsEnum, IsOptional, IsString, Length, MaxLength } from 'class-validator';

/**
 * Admin user edit (`PATCH /admin/users/:id`). Only the fields an admin may
 * change are accepted; anything else is rejected by `forbidNonWhitelisted`
 * (mass-assignment off, docs 13 §5.1). Immutable identity (username, email) is
 * deliberately absent — usernames are permanent (ADR §4). Every provided field
 * is applied and audited; `reason` is recorded in the audit metadata.
 */
export class UpdateAdminUserDto {
  @ApiPropertyOptional({ description: 'Display / pen name.', example: 'Meera K.' })
  @IsOptional()
  @IsString()
  @Length(1, PEN_NAME_MAX)
  displayName?: string;

  @ApiPropertyOptional({ enum: Object.values(Role), description: 'Set the effective role.' })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({
    enum: Object.values(UserStatus),
    description: 'Set account status (active | suspended | deactivated).',
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ description: 'Set email-verification state.' })
  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @ApiPropertyOptional({ description: 'Reason for the change (audited).', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
