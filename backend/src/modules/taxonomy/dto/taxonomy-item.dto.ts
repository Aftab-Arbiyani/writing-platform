import { ApiProperty } from '@nestjs/swagger';
import type { TextDirection } from '@qalam/shared';

/** Public shape of a language (docs 04 §3.3). */
export class LanguageDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'ur' }) code!: string;
  @ApiProperty({ example: 'Urdu' }) nameEn!: string;
  @ApiProperty({ example: 'اردو' }) nativeName!: string;
  @ApiProperty({ example: 'rtl' }) direction!: TextDirection;
  @ApiProperty({ required: false, nullable: true }) script!: string | null;
}

/** Public shape of a genre (docs 04 §3.3). */
export class GenreDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'ghazal' }) slug!: string;
  @ApiProperty({ example: 'Ghazal' }) name!: string;
}
