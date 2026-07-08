import { ApiPropertyOptional } from '@nestjs/swagger';
import { FeedSort, Visibility } from '@qalam/shared';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';

import { CursorPaginationDto } from '../../../common/dto/cursor-pagination.dto';

const READING_TIME_MAX = 24 * 60 * 60; // 24h in seconds — a sane upper bound

/**
 * Filters + sort for the browsable feeds (Latest, and Following where sensible).
 * Extends the cursor base (`cursor` + `limit`, docs 05 §5.1). Multi-value filters
 * are comma-separated (OR semantics, docs 05 §6); values validate against
 * `@qalam/shared` enums. Filters only ever NARROW a feed — they never widen it
 * past its visibility rules.
 */
export class FeedQueryDto extends CursorPaginationDto {
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

  @ApiPropertyOptional({
    enum: Object.values(Visibility),
    description: 'Narrow to a visibility within what the feed already permits.',
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
    enum: Object.values(FeedSort),
    default: FeedSort.Latest,
    description: 'latest | trending | most_clapped | most_discussed.',
  })
  @IsOptional()
  @IsEnum(FeedSort)
  sort: FeedSort = FeedSort.Latest;
}
