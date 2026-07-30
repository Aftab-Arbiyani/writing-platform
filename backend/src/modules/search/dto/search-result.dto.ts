import { ApiProperty } from '@nestjs/swagger';
import type { TextDirection, Visibility } from '@qalam/shared';

/** Author summary on a piece search result (single join, no N+1). */
export class SearchAuthorDto {
  @ApiProperty() username!: string;
  @ApiProperty({ nullable: true }) penName!: string | null;
  @ApiProperty({ nullable: true, description: 'S3 key; client builds the CDN URL.' })
  avatarKey!: string | null;
}

/** Minimal language descriptor a card needs for `dir` + reading font. */
export class SearchLanguageRefDto {
  @ApiProperty({ example: 'ur' }) code!: string;
  @ApiProperty({ example: 'rtl' }) direction!: TextDirection;
  @ApiProperty({ example: 'اردو' }) nativeName!: string;
}

export class SearchGenreRefDto {
  @ApiProperty({ example: 'ghazal' }) slug!: string;
  @ApiProperty({ example: 'Ghazal' }) name!: string;
}

/** Denormalized engagement counts (from `piece_stats`, O(1)). */
export class SearchStatsDto {
  @ApiProperty() likes!: number;
  @ApiProperty() claps!: number;
  @ApiProperty() comments!: number;
  @ApiProperty() responses!: number;
}

/**
 * A piece search result — a reading card plus the FTS relevance `rank` (higher =
 * more relevant). Full content is never returned here; readers fetch it via
 * `GET /pieces/:slug`.
 */
export class SearchPieceDto {
  @ApiProperty() id!: string;
  @ApiProperty({ nullable: true }) slug!: string | null;
  @ApiProperty() title!: string;
  @ApiProperty({ nullable: true }) subtitle!: string | null;
  @ApiProperty({ nullable: true }) featuredQuote!: string | null;
  @ApiProperty({ nullable: true }) coverImageKey!: string | null;
  @ApiProperty({ type: SearchLanguageRefDto }) language!: SearchLanguageRefDto;
  @ApiProperty({ type: SearchGenreRefDto, nullable: true }) genre!: SearchGenreRefDto | null;
  @ApiProperty({ type: SearchAuthorDto }) author!: SearchAuthorDto;
  @ApiProperty({ type: SearchStatsDto }) stats!: SearchStatsDto;
  @ApiProperty() visibility!: Visibility;
  @ApiProperty() wordCount!: number;
  @ApiProperty() readingTimeSeconds!: number;
  @ApiProperty({ nullable: true }) publishedAt!: string | null;
  @ApiProperty({ description: 'FTS relevance score (ts_rank + trigram boost).' })
  rank!: number;
}

/**
 * A writer search result. Private accounts appear (so they can be followed) but
 * as a teaser: `bio` is null and `isPrivate` is true — the client renders the
 * lock/teaser (docs 13 §4.2).
 */
export class SearchWriterDto {
  @ApiProperty() userId!: string;
  @ApiProperty() username!: string;
  @ApiProperty({ nullable: true }) penName!: string | null;
  @ApiProperty({ nullable: true, description: 'Null for private accounts (teaser).' })
  bio!: string | null;
  @ApiProperty({ nullable: true, description: 'S3 key; client builds the CDN URL.' })
  avatarKey!: string | null;
  @ApiProperty() isPrivate!: boolean;
  @ApiProperty() followersCount!: number;
  @ApiProperty() piecesCount!: number;
  @ApiProperty({ description: 'Relevance score (ts_rank + trigram over name).' })
  rank!: number;
}

/** A tag search result with its denormalized usage count. */
export class SearchTagDto {
  @ApiProperty({ example: 'barish' }) slug!: string;
  @ApiProperty({ example: 'بارش' }) name!: string;
  @ApiProperty({ description: 'Number of pieces using this tag.' }) pieceCount!: number;
}

/** A genre search result with its public-piece count. */
export class SearchGenreDto {
  @ApiProperty({ example: 'ghazal' }) slug!: string;
  @ApiProperty({ example: 'Ghazal' }) name!: string;
  @ApiProperty() pieceCount!: number;
}

/** A language search result with its public-piece count. */
export class SearchLanguageDto {
  @ApiProperty({ example: 'ur' }) code!: string;
  @ApiProperty({ example: 'اردو' }) nativeName!: string;
  @ApiProperty({ example: 'rtl' }) direction!: TextDirection;
  @ApiProperty() pieceCount!: number;
}

/**
 * `GET /search` grouped preview. Every group is present (empty array when a
 * group has no matches, or when `type` narrowed the search); each holds up to
 * `limit` top results, relevance-ranked.
 */
export class GlobalSearchResultDto {
  @ApiProperty({ type: [SearchWriterDto] }) writers!: SearchWriterDto[];
  @ApiProperty({ type: [SearchPieceDto] }) pieces!: SearchPieceDto[];
  @ApiProperty({ type: [SearchTagDto] }) tags!: SearchTagDto[];
  @ApiProperty({ type: [SearchGenreDto] }) genres!: SearchGenreDto[];
  @ApiProperty({ type: [SearchLanguageDto] }) languages!: SearchLanguageDto[];
}
