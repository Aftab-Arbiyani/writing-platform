import { ApiProperty } from '@nestjs/swagger';
import type { TextDirection } from '@qalam/shared';

/** A trending tag — ranked by pieces published within the trend window. */
export class TrendingTagDto {
  @ApiProperty({ example: 'barish' }) slug!: string;
  @ApiProperty({ example: 'barish' }) name!: string;
  @ApiProperty({ description: 'Public pieces using this tag in the trend window.' })
  pieceCount!: number;
}

/** A trending genre — ranked by recently-published public pieces. */
export class TrendingGenreDto {
  @ApiProperty({ example: 'ghazal' }) slug!: string;
  @ApiProperty({ example: 'Ghazal' }) name!: string;
  @ApiProperty() pieceCount!: number;
}

/** A trending language — ranked by recently-published public pieces. */
export class TrendingLanguageDto {
  @ApiProperty({ example: 'ur' }) code!: string;
  @ApiProperty({ example: 'اردو' }) nativeName!: string;
  @ApiProperty({ example: 'rtl' }) direction!: TextDirection;
  @ApiProperty() pieceCount!: number;
}
