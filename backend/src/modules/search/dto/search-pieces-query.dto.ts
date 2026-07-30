import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SearchSort, Visibility } from '@qalam/shared';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { CursorPaginationDto } from '../../../common/dto/cursor-pagination.dto';

const READING_TIME_MAX = 24 * 60 * 60; // 24h in seconds — a sane upper bound.

/**
 * `GET /search/pieces` — full-text piece search with filters, ranking and cursor
 * pagination (docs 05 §5.1, §6). Only published + public pieces from non-private
 * authors are ever matched (the repository enforces this — filters only narrow,
 * never widen). Multi-value filters are comma-separated with OR semantics.
 */
export class SearchPiecesQueryDto extends CursorPaginationDto {
  @ApiProperty({
    description: 'Free-text query — matches title, subtitle, content, and tags.',
    example: 'رات کی بارش',
  })
  @IsString()
  @IsNotEmpty()
  q!: string;

  @ApiPropertyOptional({
    description: 'Language code(s), comma-separated (e.g. `ur` or `hi,ur`).',
    example: 'ur',
  })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ description: 'Genre slug(s), comma-separated.', example: 'ghazal,nazm' })
  @IsOptional()
  @IsString()
  genre?: string;

  @ApiPropertyOptional({ description: 'A single tag slug.', example: 'barish' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({ description: 'Author username (exact).', example: 'meera_k' })
  @IsOptional()
  @IsString()
  author?: string;

  @ApiPropertyOptional({
    enum: Object.values(Visibility),
    description: 'Narrow to a visibility within what search already permits (public only).',
  })
  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;

  @ApiPropertyOptional({ description: 'Published on/after (ISO 8601).', example: '2026-01-01' })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Published on/before (ISO 8601).' })
  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Minimum reading time (seconds).', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(READING_TIME_MAX)
  minReadingTime?: number;

  @ApiPropertyOptional({ description: 'Maximum reading time (seconds).', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(READING_TIME_MAX)
  maxReadingTime?: number;

  @ApiPropertyOptional({
    enum: Object.values(SearchSort),
    default: SearchSort.Relevance,
    description:
      'relevance (default, ts_rank) | latest | trending | most_clapped | most_commented.',
  })
  @IsOptional()
  @IsEnum(SearchSort)
  sort: SearchSort = SearchSort.Relevance;
}
