import { ApiProperty } from '@nestjs/swagger';

import { SearchGenreDto, SearchTagDto } from './search-result.dto';

/** A popular search term with how many times it has been searched. */
export class TrendingKeywordDto {
  @ApiProperty({ example: 'barish' }) keyword!: string;
  @ApiProperty() searchCount!: number;
}

/** A popular writer surfaced by trending (most-followed public writers). */
export class TrendingWriterDto {
  @ApiProperty() username!: string;
  @ApiProperty({ nullable: true }) penName!: string | null;
  @ApiProperty({ nullable: true }) avatarKey!: string | null;
  @ApiProperty() followersCount!: number;
}

/**
 * `GET /search/trending` — what people are searching and engaging with now:
 * popular keywords (from `search_keywords`), plus popular tags/genres/writers
 * (windowed engagement, mirroring discovery). Cached in Redis (docs 18 E8).
 */
export class TrendingSearchesDto {
  @ApiProperty({ type: [TrendingKeywordDto] }) keywords!: TrendingKeywordDto[];
  @ApiProperty({ type: [SearchTagDto] }) tags!: SearchTagDto[];
  @ApiProperty({ type: [SearchGenreDto] }) genres!: SearchGenreDto[];
  @ApiProperty({ type: [TrendingWriterDto] }) writers!: TrendingWriterDto[];
}
