import { ApiProperty } from '@nestjs/swagger';

/** A ranked entity in a top-N / trending / favorites list. */
export class RankedItemDto {
  @ApiProperty({ description: 'Stable key (id / slug / code).' }) key!: string;
  @ApiProperty({ description: 'Human label (title / name / username).' }) label!: string;
  @ApiProperty() count!: number;
}

/** One growth-over-time point (from a snapshot). */
export class GrowthPointDto {
  @ApiProperty({ example: '2026-07-08' }) periodStart!: string;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  metrics!: Record<string, number>;
}

/** Share-channel breakdown ("reading sources"). */
export class ReadingSourcesDto {
  @ApiProperty() internal!: number;
  @ApiProperty() external!: number;
  @ApiProperty() copyLink!: number;
}

/** `GET /analytics/pieces/:id`. */
export class PieceAnalyticsDto {
  @ApiProperty() pieceId!: string;
  @ApiProperty() views!: number;
  @ApiProperty() uniqueViews!: number;
  @ApiProperty() reads!: number;
  @ApiProperty({ description: 'completed reads ÷ views (0–1).' }) completionRate!: number;
  @ApiProperty({ description: 'total read seconds ÷ reads.' }) averageReadTimeSeconds!: number;
  @ApiProperty() claps!: number;
  @ApiProperty() comments!: number;
  @ApiProperty() responses!: number;
  @ApiProperty() bookmarks!: number;
  @ApiProperty() shares!: number;
  @ApiProperty({ type: ReadingSourcesDto }) readingSources!: ReadingSourcesDto;
  @ApiProperty({ nullable: true }) publishedAt!: string | null;
}

export class MostPopularPieceDto {
  @ApiProperty() pieceId!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ nullable: true }) slug!: string | null;
  @ApiProperty() views!: number;
}

/** `GET /analytics/me` (the writer's own analytics). */
export class WriterAnalyticsDto {
  @ApiProperty() totalViews!: number;
  @ApiProperty() uniqueViews!: number;
  @ApiProperty() reads!: number;
  @ApiProperty() completionRate!: number;
  @ApiProperty() totalReadSeconds!: number;
  @ApiProperty() averageReadTimeSeconds!: number;
  @ApiProperty() followersGained!: number;
  @ApiProperty() piecesPublished!: number;
  @ApiProperty() piecesArchived!: number;
  @ApiProperty() commentsReceived!: number;
  @ApiProperty() clapsReceived!: number;
  @ApiProperty() bookmarksReceived!: number;
  @ApiProperty() responsesReceived!: number;
  @ApiProperty({ type: MostPopularPieceDto, nullable: true })
  mostPopularPiece!: MostPopularPieceDto | null;
}

/** `GET /analytics/readers/me`. */
export class ReaderAnalyticsDto {
  @ApiProperty() piecesRead!: number;
  @ApiProperty() readingTimeSeconds!: number;
  @ApiProperty() completedReads!: number;
  @ApiProperty() currentStreak!: number;
  @ApiProperty() longestStreak!: number;
  @ApiProperty({ type: [RankedItemDto] }) favoriteGenres!: RankedItemDto[];
  @ApiProperty({ type: [RankedItemDto] }) favoriteLanguages!: RankedItemDto[];
}

/** `GET /analytics/platform` (admin). */
export class PlatformAnalyticsDto {
  @ApiProperty() totalUsers!: number;
  @ApiProperty({ description: 'Daily active users (login within 1d).' }) dailyActiveUsers!: number;
  @ApiProperty({ description: 'Monthly active users (login within 30d).' })
  monthlyActiveUsers!: number;
  @ApiProperty() newRegistrations!: number;
  @ApiProperty() publishedPieces!: number;
  @ApiProperty() draftPieces!: number;
  @ApiProperty() comments!: number;
  @ApiProperty() claps!: number;
  @ApiProperty() bookmarks!: number;
  @ApiProperty() collections!: number;
  @ApiProperty() views!: number;
  @ApiProperty() reads!: number;
  @ApiProperty({ type: [RankedItemDto] }) topLanguages!: RankedItemDto[];
  @ApiProperty({ type: [RankedItemDto] }) topGenres!: RankedItemDto[];
  @ApiProperty({ type: [RankedItemDto] }) topTags!: RankedItemDto[];
  @ApiProperty({ type: [RankedItemDto] }) topWriters!: RankedItemDto[];
}

/** `GET /analytics/trending`. */
export class TrendingDto {
  @ApiProperty({ example: 'weekly' }) period!: string;
  @ApiProperty({ type: [RankedItemDto] }) pieces!: RankedItemDto[];
  @ApiProperty({ type: [RankedItemDto] }) writers!: RankedItemDto[];
  @ApiProperty({ type: [RankedItemDto] }) genres!: RankedItemDto[];
  @ApiProperty({ type: [RankedItemDto] }) tags!: RankedItemDto[];
}

/** `GET /analytics/dashboard` — the signed-in user's combined view. */
export class DashboardDto {
  @ApiProperty({ type: WriterAnalyticsDto }) writer!: WriterAnalyticsDto;
  @ApiProperty({ type: ReaderAnalyticsDto }) reader!: ReaderAnalyticsDto;
}

/** Growth-over-time series (writer or platform). */
export class GrowthSeriesDto {
  @ApiProperty({ example: 'daily' }) period!: string;
  @ApiProperty({ type: [GrowthPointDto] }) points!: GrowthPointDto[];
}

/** Result of an admin snapshot-generation run. */
export class SnapshotResultDto {
  @ApiProperty() period!: string;
  @ApiProperty() periodStart!: string;
  @ApiProperty({ description: 'How many snapshot rows were written.' }) snapshotsWritten!: number;
}
