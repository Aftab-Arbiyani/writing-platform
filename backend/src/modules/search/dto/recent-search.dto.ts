import { ApiProperty } from '@nestjs/swagger';

/**
 * One stored recent search for the signed-in user (`GET /search/recent`).
 * `query` is the normalized term; `id` is what `DELETE /search/recent/:id` takes.
 */
export class RecentSearchDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'barish' }) query!: string;
  @ApiProperty({ example: 'all', description: 'The scope the term was searched in.' })
  searchType!: string;
  @ApiProperty({ description: 'When the term was last searched (ISO 8601).' })
  searchedAt!: string;
}
