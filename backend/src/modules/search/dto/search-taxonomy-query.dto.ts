import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

import { CursorPaginationDto } from '../../../common/dto/cursor-pagination.dto';

/**
 * `GET /search/tags | /search/genres | /search/languages` — reference-data
 * search. `q` is OPTIONAL: with it, prefix + fuzzy match on name/slug/code;
 * without it, a browse ordered by usage (piece count). Cursor-paginated over
 * `(pieceCount, id)` so results stay stable as counts shift.
 */
export class SearchTaxonomyQueryDto extends CursorPaginationDto {
  @ApiPropertyOptional({
    description: 'Free-text prefix/fuzzy match; omit to browse by popularity.',
    example: 'ghaz',
  })
  @IsOptional()
  @IsString()
  q?: string;
}
