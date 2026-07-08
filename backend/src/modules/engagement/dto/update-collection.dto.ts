import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  COLLECTION_DESCRIPTION_MAX,
  COLLECTION_NAME_MAX,
  COLLECTION_NAME_MIN,
  Visibility,
} from '@qalam/shared';
import { IsEnum, IsOptional, IsString, Length, MaxLength } from 'class-validator';

/**
 * `PATCH /collections/:id` body (rename / re-describe / re-scope). Every field
 * is optional — merge semantics (docs 05 §1). The default "Favorites" collection
 * rejects a title change (`COLLECTION_DEFAULT_IMMUTABLE`).
 */
export class UpdateCollectionDto {
  @ApiPropertyOptional({ minLength: COLLECTION_NAME_MIN, maxLength: COLLECTION_NAME_MAX })
  @IsOptional()
  @IsString()
  @Length(COLLECTION_NAME_MIN, COLLECTION_NAME_MAX)
  title?: string;

  @ApiPropertyOptional({ maxLength: COLLECTION_DESCRIPTION_MAX, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(COLLECTION_DESCRIPTION_MAX)
  description?: string;

  @ApiPropertyOptional({ enum: Object.values(Visibility) })
  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;
}
