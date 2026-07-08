import { ApiProperty } from '@nestjs/swagger';
import { MAX_CLAPS_PER_USER_PER_PIECE } from '@qalam/shared';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * `POST /pieces/:id/claps` body — claps are accumulated client-side (press-and-
 * hold) then flushed. The server applies `min(count, 50 - current)`; a request
 * when already at the cap fails with `CLAP_LIMIT_REACHED` (docs 05 §11.7).
 */
export class ClapDto {
  @ApiProperty({
    minimum: 1,
    maximum: MAX_CLAPS_PER_USER_PER_PIECE,
    default: 1,
    description: 'How many claps to add this request.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_CLAPS_PER_USER_PER_PIECE)
  count: number = 1;
}

/** `{ viewerClaps, totalClaps }` — the viewer's running count and the piece total. */
export class ClapResponseDto {
  @ApiProperty({ description: "This viewer's clap count (1..50)." }) viewerClaps!: number;
  @ApiProperty({ description: 'Total claps on the piece (all users).' }) totalClaps!: number;
}

/** `{ liked, totalLikes }` — result of like/unlike (idempotent). */
export class LikeResponseDto {
  @ApiProperty() liked!: boolean;
  @ApiProperty() totalLikes!: number;
}

/** `{ bookmarked }` — result of bookmark/un-bookmark (private; no piece total). */
export class BookmarkResponseDto {
  @ApiProperty() bookmarked!: boolean;
}

/** A bookmarked piece in the owner's private `/me/bookmarks` list. */
export class BookmarkItemDto {
  @ApiProperty() pieceId!: string;
  @ApiProperty({ nullable: true }) slug!: string | null;
  @ApiProperty() title!: string;
  @ApiProperty({ description: 'When the piece was bookmarked.' }) bookmarkedAt!: string;
}
