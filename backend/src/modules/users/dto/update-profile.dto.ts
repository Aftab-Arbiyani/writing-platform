import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  BIO_MAX,
  LOCATION_MAX,
  MAX_GENRES_PER_PROFILE,
  PEN_NAME_MAX,
  PEN_NAME_MIN,
  WEBSITE_URL_MAX,
} from '@qalam/shared';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
} from 'class-validator';

/**
 * `PATCH /me` body. All fields optional (partial update). `username` is
 * intentionally absent — it is permanent (ADR §4). `socialLinks` value URLs and
 * count are validated in the service (class-validator can't reach record values).
 * `defaultLanguageCode`/`genres` are resolved + validated against the taxonomy.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ minLength: PEN_NAME_MIN, maxLength: PEN_NAME_MAX })
  @IsOptional()
  @IsString()
  @Length(PEN_NAME_MIN, PEN_NAME_MAX)
  penName?: string;

  @ApiPropertyOptional({ maxLength: BIO_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(BIO_MAX)
  bio?: string;

  @ApiPropertyOptional({ maxLength: WEBSITE_URL_MAX, example: 'https://meera.example' })
  @IsOptional()
  @IsUrl()
  @MaxLength(WEBSITE_URL_MAX)
  websiteUrl?: string;

  @ApiPropertyOptional({ maxLength: LOCATION_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(LOCATION_MAX)
  location?: string;

  @ApiPropertyOptional({
    additionalProperties: { type: 'string' },
    example: { twitter: 'https://x.com/meera', instagram: 'https://instagram.com/meera' },
  })
  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Account privacy — private requires follow approval.' })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @ApiPropertyOptional({ example: 'ur', description: 'Preferred compose language (BCP-47 code).' })
  @IsOptional()
  @IsString()
  @Length(2, 10)
  defaultLanguageCode?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['ghazal', 'nazm'],
    maxItems: MAX_GENRES_PER_PROFILE,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_GENRES_PER_PROFILE)
  @IsString({ each: true })
  genres?: string[];
}
