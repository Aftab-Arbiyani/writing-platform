import { ApiPropertyOptional } from '@nestjs/swagger';
import { PAGE_SIZE_DEFAULT } from '@qalam/shared';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Base query DTO for offset-paginated list endpoints — **admin tables only**
 * (docs 05 §5.2: jump-to-page + totals are acceptable there, never on feeds).
 * Admin filter DTOs extend this and add their own params.
 *
 * Offset max is 100 per docs 05 §5.2 (higher than the cursor cap of
 * PAGE_SIZE_MAX, because staff grids page through moderate, indexed tables).
 */
export const OFFSET_PAGE_SIZE_MAX = 100;

export class OffsetPaginationDto {
  @ApiPropertyOptional({ description: '1-based page number.', minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: `Items per page (default ${PAGE_SIZE_DEFAULT}, max ${OFFSET_PAGE_SIZE_MAX}).`,
    minimum: 1,
    maximum: OFFSET_PAGE_SIZE_MAX,
    default: PAGE_SIZE_DEFAULT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(OFFSET_PAGE_SIZE_MAX)
  limit: number = PAGE_SIZE_DEFAULT;

  /** Zero-based row offset derived from page/limit — for repository queries. */
  get offset(): number {
    return (this.page - 1) * this.limit;
  }
}
