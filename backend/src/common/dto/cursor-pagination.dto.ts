import { ApiPropertyOptional } from '@nestjs/swagger';
import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '@qalam/shared';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Base query DTO for cursor-paginated list endpoints (feeds, timelines,
 * notifications — docs 05 §5.1). Feature filter DTOs extend this
 * (`class FeedQueryDto extends CursorPaginationDto`) and add their own params.
 *
 * `@Type(() => Number)` is required because the global ValidationPipe runs with
 * `enableImplicitConversion: false` (main.ts) — query strings are strings until
 * a DTO says otherwise.
 */
export class CursorPaginationDto {
  @ApiPropertyOptional({
    description: 'Opaque keyset cursor from a previous page. Omit for the first page.',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: `Items per page (default ${PAGE_SIZE_DEFAULT}, max ${PAGE_SIZE_MAX}).`,
    minimum: 1,
    maximum: PAGE_SIZE_MAX,
    default: PAGE_SIZE_DEFAULT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGE_SIZE_MAX)
  limit: number = PAGE_SIZE_DEFAULT;
}
