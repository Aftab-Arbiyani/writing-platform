import { ApiProperty } from '@nestjs/swagger';
import type { TextDirection, Visibility } from '@qalam/shared';

/** Author summary on a feed card (single join, no N+1). */
export class FeedAuthorDto {
  @ApiProperty() username!: string;
  @ApiProperty({ nullable: true }) penName!: string | null;
  @ApiProperty({ nullable: true, description: 'S3 key; client builds the CDN URL.' })
  avatarKey!: string | null;
}

/** Minimal language descriptor a card needs for `dir` + reading font. */
export class FeedLanguageDto {
  @ApiProperty({ example: 'ur' }) code!: string;
  @ApiProperty({ example: 'rtl' }) direction!: TextDirection;
  @ApiProperty({ example: 'اردو' }) nativeName!: string;
}

export class FeedGenreDto {
  @ApiProperty({ example: 'ghazal' }) slug!: string;
  @ApiProperty({ example: 'Ghazal' }) name!: string;
}

/** Denormalized engagement counts shown on a card (from `piece_stats`, O(1)). */
export class FeedStatsDto {
  @ApiProperty() likes!: number;
  @ApiProperty() claps!: number;
  @ApiProperty() comments!: number;
  @ApiProperty() responses!: number;
}

/**
 * A piece card for every feed + discovery list — only the fields a card renders
 * (docs 05 §11.4; "return only required fields"). Full content is never in a
 * feed; readers fetch it via `GET /pieces/:slug`.
 */
export class FeedItemDto {
  @ApiProperty() id!: string;
  @ApiProperty({ nullable: true }) slug!: string | null;
  @ApiProperty() title!: string;
  @ApiProperty({ nullable: true }) subtitle!: string | null;
  @ApiProperty({ nullable: true }) featuredQuote!: string | null;
  @ApiProperty({ nullable: true }) coverImageKey!: string | null;
  @ApiProperty({ type: FeedLanguageDto }) language!: FeedLanguageDto;
  @ApiProperty({ type: FeedGenreDto, nullable: true }) genre!: FeedGenreDto | null;
  @ApiProperty({ type: FeedAuthorDto }) author!: FeedAuthorDto;
  @ApiProperty({ type: FeedStatsDto }) stats!: FeedStatsDto;
  @ApiProperty() visibility!: Visibility;
  @ApiProperty() wordCount!: number;
  @ApiProperty() readingTimeSeconds!: number;
  @ApiProperty({ nullable: true }) publishedAt!: string | null;
}
