import { ApiProperty } from '@nestjs/swagger';

/** Denormalized engagement counts for a piece (from `piece_stats`, O(1) read). */
export class PieceEngagementStatsDto {
  @ApiProperty() likes!: number;
  @ApiProperty() claps!: number;
  @ApiProperty() bookmarks!: number;
  @ApiProperty() comments!: number;
  @ApiProperty() responses!: number;
  @ApiProperty() shares!: number;
}

/** The current viewer's relation to a piece (all false/0 for anonymous viewers). */
export class PieceEngagementViewerDto {
  @ApiProperty() hasLiked!: boolean;
  @ApiProperty({ description: "This viewer's clap count (0..50)." }) clapCount!: number;
  @ApiProperty() hasBookmarked!: boolean;
}

/**
 * `GET /pieces/:id/engagement` — the engagement summary for the reading surface:
 * total counts plus the viewer's own like/clap/bookmark state, in one O(1) read
 * (counters, never `COUNT(*)` — docs 04 §7).
 */
export class PieceEngagementDto {
  @ApiProperty({ type: PieceEngagementStatsDto }) stats!: PieceEngagementStatsDto;
  @ApiProperty({ type: PieceEngagementViewerDto }) viewer!: PieceEngagementViewerDto;
}
