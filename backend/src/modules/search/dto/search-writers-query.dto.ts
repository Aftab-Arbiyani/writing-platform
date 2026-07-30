import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { CursorPaginationDto } from '../../../common/dto/cursor-pagination.dto';

/**
 * `GET /search/writers` — writer search over username / pen name / bio, ranked
 * relevance-first and cursor-paginated. Private accounts remain findable (you
 * must be able to locate one to request a follow) but are returned as a teaser
 * (no bio) and are matched by name only — never by bio content (docs 13 §4.2).
 * Optional `language`/`genre` narrow to a writer's declared craft.
 */
export class SearchWritersQueryDto extends CursorPaginationDto {
  @ApiProperty({
    description: 'Free-text query — matches username, pen name, bio.',
    example: 'meera',
  })
  @IsString()
  @IsNotEmpty()
  q!: string;

  @ApiPropertyOptional({
    description: 'Filter to writers whose default writing language matches this code.',
    example: 'ur',
  })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({
    description: 'Filter to writers who list this genre among their writing genres.',
    example: 'ghazal',
  })
  @IsOptional()
  @IsString()
  genre?: string;
}
