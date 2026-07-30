import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { ENVIRONMENT_SCOPES } from '../settings.constants';

/** Dot-cased, lower-case flag key with at least one dot, e.g. `feature.ai.enabled`. */
const FLAG_KEY_PATTERN = /^[a-z0-9]+(\.[a-z0-9]+)+$/;

/** The wire shape of a feature flag (E12.8). */
export class FeatureFlagDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'feature.ai.enabled' }) key!: string;
  @ApiProperty({ example: false }) enabled!: boolean;
  @ApiProperty({ minimum: 0, maximum: 100, example: 0 }) rolloutPercentage!: number;
  @ApiProperty({ enum: ENVIRONMENT_SCOPES, example: 'all' }) environment!: string;
  @ApiProperty({ example: 'AI writing assistance (Phase 2).' }) description!: string;
  @ApiProperty({ nullable: true }) updatedBy!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

/** Create a feature flag (`POST /admin/feature-flags`). */
export class CreateFeatureFlagDto {
  @ApiProperty({
    example: 'feature.ai.enabled',
    description: 'Dot-cased lower-case key (validated), e.g. `feature.ai.enabled`.',
  })
  @IsString()
  @MaxLength(120)
  @Matches(FLAG_KEY_PATTERN, {
    message: 'key must be dot-cased lower-case, e.g. feature.ai.enabled',
  })
  key!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercentage?: number;

  @ApiPropertyOptional({ enum: ENVIRONMENT_SCOPES, default: 'all' })
  @IsOptional()
  @IsIn(ENVIRONMENT_SCOPES)
  environment?: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;
}

/** Partially update a feature flag (`PATCH /admin/feature-flags/:id`). */
export class UpdateFeatureFlagDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercentage?: number;

  @ApiPropertyOptional({ enum: ENVIRONMENT_SCOPES })
  @IsOptional()
  @IsIn(ENVIRONMENT_SCOPES)
  environment?: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;
}
