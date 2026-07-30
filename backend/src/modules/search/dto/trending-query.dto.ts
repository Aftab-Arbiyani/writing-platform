import { ApiPropertyOptional } from '@nestjs/swagger';
import { PAGE_SIZE_MAX, TRENDING_SEARCHES_LIMIT } from '@qalam/shared';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * `GET /search/trending` — no free text; just how many items per group
 * (keywords / tags / genres / writers) to surface. Cached (docs 18 E8 perf).
 */
export class TrendingQueryDto {
  @ApiPropertyOptional({
    description: 'Max items per trending group.',
    minimum: 1,
    maximum: PAGE_SIZE_MAX,
    default: TRENDING_SEARCHES_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGE_SIZE_MAX)
  limit: number = TRENDING_SEARCHES_LIMIT;
}
