import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FEATURED_QUOTE_MAX,
  SUBTITLE_MAX,
  TAGS_MAX_PER_PIECE,
  TITLE_MAX,
  Visibility,
} from '@qalam/shared';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

/**
 * `POST /pieces` body (create draft). `content` is the TipTap JSON doc — deeply
 * validated by the server sanitizer in the service (docs 13 §5.2), not here.
 * One language per piece (required even for drafts — docs 04 §3.2). Genre is
 * optional for a draft, required at publish.
 */
export class CreatePieceDto {
  @ApiPropertyOptional({ maxLength: TITLE_MAX, description: 'Drafts may be untitled.' })
  @IsOptional()
  @IsString()
  @MaxLength(TITLE_MAX)
  title?: string;

  @ApiPropertyOptional({ maxLength: SUBTITLE_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(SUBTITLE_MAX)
  subtitle?: string;

  @ApiPropertyOptional({ maxLength: FEATURED_QUOTE_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(FEATURED_QUOTE_MAX)
  featuredQuote?: string;

  @ApiPropertyOptional({ description: 'TipTap document (defaults to an empty doc).' })
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @ApiProperty({ example: 'ur', description: 'Content language (BCP-47 code) — one per piece.' })
  @IsString()
  @Length(2, 10)
  languageCode!: string;

  @ApiPropertyOptional({ example: 'ghazal', description: 'Genre slug (required at publish).' })
  @IsOptional()
  @IsString()
  genreSlug?: string;

  @ApiPropertyOptional({ enum: Object.values(Visibility), default: Visibility.Public })
  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;

  @ApiPropertyOptional({
    type: [String],
    maxItems: TAGS_MAX_PER_PIECE,
    example: ['barish', 'raat'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(TAGS_MAX_PER_PIECE)
  @IsString({ each: true })
  tags?: string[];
}
