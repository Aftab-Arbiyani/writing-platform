import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportEntityType, ReportReason } from '@qalam/shared';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** Body for `POST /reports` — any authenticated user reports a piece/comment/user/response. */
export class CreateReportDto {
  @ApiProperty({ enum: Object.values(ReportEntityType), example: ReportEntityType.Piece })
  @IsEnum(ReportEntityType)
  entityType!: ReportEntityType;

  @ApiProperty({ format: 'uuid', description: 'Id of the reported entity.' })
  @IsUUID()
  entityId!: string;

  @ApiProperty({ enum: Object.values(ReportReason), example: ReportReason.Harassment })
  @IsEnum(ReportReason)
  reason!: ReportReason;

  @ApiPropertyOptional({
    maxLength: 1000,
    description: 'Free-text context; recommended for `other`.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
