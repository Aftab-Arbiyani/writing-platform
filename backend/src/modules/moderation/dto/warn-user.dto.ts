import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportSeverity } from '@qalam/shared';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/** Body for `POST /admin/users/:id/warn` — issue a formal warning to a user. */
export class WarnUserDto {
  @ApiProperty({ minLength: 1, maxLength: 1000, description: 'The warning message (audited).' })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;

  @ApiPropertyOptional({ enum: Object.values(ReportSeverity), default: ReportSeverity.Low })
  @IsOptional()
  @IsEnum(ReportSeverity)
  severity?: ReportSeverity;

  @ApiPropertyOptional({ format: 'uuid', description: 'Report that prompted the warning, if any.' })
  @IsOptional()
  @IsUUID()
  reportId?: string;
}
