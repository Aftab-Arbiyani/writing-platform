import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AUTOCOMPLETE_LIMIT_DEFAULT, AUTOCOMPLETE_LIMIT_MAX, SearchType } from '@qalam/shared';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * `GET /search/autocomplete` — prefix-first suggestions across writers, tags,
 * genres and piece titles. `limit` is capped at 10 per group (brief). `type`
 * narrows to a single group; `all` (default) returns every group.
 */
export class AutocompleteQueryDto {
  @ApiProperty({ description: 'Partial query to complete.', example: 'gha' })
  @IsString()
  @IsNotEmpty()
  q!: string;

  @ApiPropertyOptional({
    enum: Object.values(SearchType),
    default: SearchType.All,
    description: 'Restrict suggestions to one group (languages yield none).',
  })
  @IsOptional()
  @IsEnum(SearchType)
  type: SearchType = SearchType.All;

  @ApiPropertyOptional({
    description: 'Max suggestions per group.',
    minimum: 1,
    maximum: AUTOCOMPLETE_LIMIT_MAX,
    default: AUTOCOMPLETE_LIMIT_DEFAULT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(AUTOCOMPLETE_LIMIT_MAX)
  limit: number = AUTOCOMPLETE_LIMIT_DEFAULT;
}
