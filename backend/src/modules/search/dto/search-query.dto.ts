import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GLOBAL_SEARCH_GROUP_SIZE, PAGE_SIZE_MAX, SearchType } from '@qalam/shared';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * `GET /search` — the grouped global preview (writers/pieces/tags/genres/
 * languages). Not cursor-paginated: it returns a small top-N per group (the
 * per-type endpoints own deep pagination). Free-text `q` is required; the
 * minimum-length rule (`SEARCH_QUERY_TOO_SHORT`) is enforced after normalization
 * in the service, not here (docs 05 §3.2).
 */
export class SearchQueryDto {
  @ApiProperty({ description: 'Free-text query (websearch syntax supported).', example: 'barish' })
  @IsString()
  @IsNotEmpty()
  q!: string;

  @ApiPropertyOptional({
    enum: Object.values(SearchType),
    default: SearchType.All,
    description: 'Restrict to one group, or `all` for the grouped preview.',
  })
  @IsOptional()
  @IsEnum(SearchType)
  type: SearchType = SearchType.All;

  @ApiPropertyOptional({
    description: 'Max results per group.',
    minimum: 1,
    maximum: PAGE_SIZE_MAX,
    default: GLOBAL_SEARCH_GROUP_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGE_SIZE_MAX)
  limit: number = GLOBAL_SEARCH_GROUP_SIZE;
}
