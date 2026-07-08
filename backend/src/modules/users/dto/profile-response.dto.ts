import { ApiProperty } from '@nestjs/swagger';

import { GenreDto } from '../../taxonomy/dto/taxonomy-item.dto';

/**
 * Profile aggregate counts. `followers`/`following`/`piecesPublished` come from
 * the denormalized profile row (single read, no N+1, no COUNT(*) — docs 04 §7).
 * The engagement metrics are 0 until their source tables ship (pieces E4;
 * likes/claps/bookmarks/responses E7) — surfaced now for a stable response shape.
 */
export class ProfileCountsDto {
  @ApiProperty() followers!: number;
  @ApiProperty() following!: number;
  @ApiProperty() piecesPublished!: number;
  @ApiProperty({ description: '0 until reading tracking ships (E5).' }) totalReads!: number;
  @ApiProperty({ description: '0 until engagement ships (E7).' }) totalLikes!: number;
  @ApiProperty({ description: '0 until engagement ships (E7).' }) totalClaps!: number;
  @ApiProperty({ description: '0 until engagement ships (E7).' }) bookmarksReceived!: number;
  @ApiProperty({ description: '0 until responses ship (E7).' }) responseCount!: number;
}

/** The viewer's relationship to the profile owner (drives follow-button state). */
export class ViewerRelationDto {
  @ApiProperty() isSelf!: boolean;
  @ApiProperty() isFollowing!: boolean;
  @ApiProperty() hasPendingRequest!: boolean;
}

/**
 * Full profile response. For a private account viewed by a non-follower stranger,
 * the restricted fields are omitted and `restricted` is true (docs 13 §4.2 teaser).
 */
export class ProfileResponseDto {
  @ApiProperty() username!: string;
  @ApiProperty() penName!: string;
  @ApiProperty({ nullable: true }) avatarKey!: string | null;
  @ApiProperty() isPrivate!: boolean;
  @ApiProperty({ type: ProfileCountsDto }) counts!: ProfileCountsDto;
  @ApiProperty({ type: ViewerRelationDto }) viewerRelation!: ViewerRelationDto;

  @ApiProperty({ description: 'True when a private profile is shown as a teaser to a stranger.' })
  restricted!: boolean;

  // Present only when not restricted:
  @ApiProperty({ required: false, nullable: true }) bio?: string | null;
  @ApiProperty({ required: false, nullable: true }) coverKey?: string | null;
  @ApiProperty({ required: false, nullable: true }) websiteUrl?: string | null;
  @ApiProperty({ required: false, nullable: true }) location?: string | null;
  @ApiProperty({ required: false, additionalProperties: { type: 'string' } })
  socialLinks?: Record<string, string>;
  @ApiProperty({ required: false, nullable: true }) defaultLanguageId?: string | null;
  @ApiProperty({ required: false, type: [GenreDto] }) genres?: GenreDto[];
}

/** `{ key }` returned by avatar/cover upload — clients build the CDN URL. */
export class MediaKeyResponseDto {
  @ApiProperty({ example: 'profiles/<uuid>/avatar-<uuid>.webp' }) key!: string;
}
