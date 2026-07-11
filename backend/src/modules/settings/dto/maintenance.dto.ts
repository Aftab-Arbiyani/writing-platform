import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const MAINTENANCE_ROLES = ['super_admin', 'admin', 'moderator', 'user'] as const;

/** The strongly-typed maintenance-mode view (backed by `maintenance.*` settings). */
export class MaintenanceDto {
  @ApiProperty({ example: false }) enabled!: boolean;
  @ApiProperty({ example: 'We will be back shortly.' }) message!: string;
  @ApiProperty({ nullable: true, description: 'ISO 8601 estimate, or null.' })
  estimatedCompletion!: string | null;
  @ApiProperty({ type: [String], example: ['super_admin', 'admin'] })
  allowedRoles!: string[];
}

/** Update maintenance mode (`PATCH /admin/maintenance`). All fields optional. */
export class UpdateMaintenanceDto {
  @ApiPropertyOptional({ description: 'Turn maintenance mode on/off.' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;

  @ApiPropertyOptional({ description: 'Estimated completion (ISO 8601).' })
  @IsOptional()
  @IsISO8601()
  estimatedCompletion?: string;

  @ApiPropertyOptional({
    type: [String],
    enum: MAINTENANCE_ROLES,
    description: 'Roles allowed through during maintenance.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsIn(MAINTENANCE_ROLES, { each: true })
  allowedRoles?: string[];

  @ApiPropertyOptional({ description: 'Why the change was made (audited).', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
