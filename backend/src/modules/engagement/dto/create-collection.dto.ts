import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  COLLECTION_DESCRIPTION_MAX,
  COLLECTION_NAME_MAX,
  COLLECTION_NAME_MIN,
  Visibility,
} from '@qalam/shared';
import { IsEnum, IsOptional, IsString, Length, MaxLength } from 'class-validator';

/**
 * `POST /collections` body. Collections are private by default in Phase 1
 * (E7 scope); `visibility` is accepted for forward-compat but reads stay
 * owner-only. The slug is derived from `title` server-side (unique per owner).
 */
export class CreateCollectionDto {
  @ApiProperty({ minLength: COLLECTION_NAME_MIN, maxLength: COLLECTION_NAME_MAX })
  @IsString()
  @Length(COLLECTION_NAME_MIN, COLLECTION_NAME_MAX)
  title!: string;

  @ApiPropertyOptional({ maxLength: COLLECTION_DESCRIPTION_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(COLLECTION_DESCRIPTION_MAX)
  description?: string;

  @ApiPropertyOptional({ enum: Object.values(Visibility), default: Visibility.Private })
  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;
}
