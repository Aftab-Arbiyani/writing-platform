import { ApiProperty } from '@nestjs/swagger';

/** A writer autocomplete suggestion (name-safe fields only). */
export class WriterSuggestionDto {
  @ApiProperty() username!: string;
  @ApiProperty({ nullable: true }) penName!: string | null;
  @ApiProperty({ nullable: true }) avatarKey!: string | null;
}

/** A tag autocomplete suggestion. */
export class TagSuggestionDto {
  @ApiProperty({ example: 'barish' }) slug!: string;
  @ApiProperty({ example: 'بارش' }) name!: string;
}

/** A genre autocomplete suggestion. */
export class GenreSuggestionDto {
  @ApiProperty({ example: 'ghazal' }) slug!: string;
  @ApiProperty({ example: 'Ghazal' }) name!: string;
}

/** A piece-title autocomplete suggestion. */
export class PieceSuggestionDto {
  @ApiProperty({ nullable: true }) slug!: string | null;
  @ApiProperty() title!: string;
}

/**
 * `GET /search/autocomplete` result. Each group is capped at the requested limit
 * (≤ 10). Groups the `type` filter excluded come back empty.
 */
export class AutocompleteResultDto {
  @ApiProperty({ type: [WriterSuggestionDto] }) writers!: WriterSuggestionDto[];
  @ApiProperty({ type: [TagSuggestionDto] }) tags!: TagSuggestionDto[];
  @ApiProperty({ type: [GenreSuggestionDto] }) genres!: GenreSuggestionDto[];
  @ApiProperty({ type: [PieceSuggestionDto] }) pieces!: PieceSuggestionDto[];
}
