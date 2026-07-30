import { ApiProperty } from '@nestjs/swagger';

import { RankedItemDto } from './analytics-response.dto';

/** One point in a daily time series. */
export class SeriesPointDto {
  @ApiProperty({ example: '2026-07-10' }) date!: string;
  @ApiProperty() count!: number;
}

/** Per-queue depth snapshot (from the BullMQ registry). */
export class QueueStatDto {
  @ApiProperty() name!: string;
  @ApiProperty() waiting!: number;
  @ApiProperty({ description: 'Jobs currently processing (≈ busy workers).' }) active!: number;
  @ApiProperty() completed!: number;
  @ApiProperty() failed!: number;
  @ApiProperty() delayed!: number;
}

/** Largest relations by on-disk size. */
export class TableSizeDto {
  @ApiProperty() table!: string;
  @ApiProperty({ description: 'Total relation size in bytes.' }) bytes!: number;
}

/**
 * Platform Overview (`GET /admin/analytics/overview`, E12.9). Headline counts +
 * a period-over-period growth rate. `databaseSizeBytes` is the tracked storage
 * (object-storage/MinIO usage is not captured — see `storageNote` on system).
 */
export class PlatformOverviewDto {
  @ApiProperty() totalUsers!: number;
  @ApiProperty() verifiedUsers!: number;
  @ApiProperty({ description: 'Users active (login) within the last 30 days.' })
  activeUsers!: number;
  @ApiProperty({ description: 'Registrations within the selected range.' }) newUsers!: number;
  @ApiProperty() privateAccounts!: number;
  @ApiProperty() publishedPieces!: number;
  @ApiProperty() drafts!: number;
  @ApiProperty() comments!: number;
  @ApiProperty() responses!: number;
  @ApiProperty({ description: 'Total reports (open + resolved + dismissed).' }) reports!: number;
  @ApiProperty() resolvedReports!: number;
  @ApiProperty() bookmarks!: number;
  @ApiProperty() claps!: number;
  @ApiProperty() followers!: number;
  @ApiProperty({ description: 'Database size in bytes (tracked storage).' })
  databaseSizeBytes!: number;
  @ApiProperty({ description: 'New-user growth vs the previous equal period (%).' })
  growthRatePct!: number;
  @ApiProperty({ description: 'When this snapshot was computed (ISO 8601).' }) generatedAt!: string;
}

/**
 * User Analytics (`GET /admin/analytics/users`). Top countries/devices are
 * returned empty — the tracking model captures no geo/device dimension.
 */
export class UserAnalyticsDto {
  @ApiProperty({ description: 'Registrations within the range.' }) registrations!: number;
  @ApiProperty({ description: 'Users active (login) within the range.' }) activeUsers!: number;
  @ApiProperty({ description: 'Retention: pre-window users still active in-window (%).' })
  retentionPct!: number;
  @ApiProperty({ description: 'Daily active users (1d).' }) dailyActiveUsers!: number;
  @ApiProperty({ description: 'Weekly active users (7d).' }) weeklyActiveUsers!: number;
  @ApiProperty({ description: 'Monthly active users (30d).' }) monthlyActiveUsers!: number;
  @ApiProperty({ type: [RankedItemDto], description: 'Empty — geo not tracked.' })
  topCountries!: RankedItemDto[];
  @ApiProperty({ type: [RankedItemDto] }) topLanguages!: RankedItemDto[];
  @ApiProperty({ type: [RankedItemDto], description: 'Empty — device not tracked.' })
  topDevices!: RankedItemDto[];
  @ApiProperty({ type: [SeriesPointDto], description: 'Daily registrations across the range.' })
  registrationsSeries!: SeriesPointDto[];
}

/** Content Analytics (`GET /admin/analytics/content`). */
export class ContentAnalyticsDto {
  @ApiProperty() publishedPieces!: number;
  @ApiProperty() drafts!: number;
  @ApiProperty({ type: [RankedItemDto] }) piecesPerLanguage!: RankedItemDto[];
  @ApiProperty({ type: [RankedItemDto] }) piecesPerGenre!: RankedItemDto[];
  @ApiProperty({ description: 'Mean read dwell time in seconds.' }) averageReadingSeconds!: number;
  @ApiProperty({ description: 'Mean completion rate (0–1).' }) averageCompletionRate!: number;
  @ApiProperty({ type: [RankedItemDto] }) mostViewedPieces!: RankedItemDto[];
  @ApiProperty({ type: [RankedItemDto] }) mostSharedPieces!: RankedItemDto[];
}

/** Engagement Analytics (`GET /admin/analytics/engagement`). */
export class EngagementAnalyticsDto {
  @ApiProperty() views!: number;
  @ApiProperty() reads!: number;
  @ApiProperty({ description: 'Total read dwell time in seconds.' }) readingSeconds!: number;
  @ApiProperty({ description: 'Completion rate (0–1).' }) completionRate!: number;
  @ApiProperty() bookmarks!: number;
  @ApiProperty() claps!: number;
  @ApiProperty() comments!: number;
  @ApiProperty() responses!: number;
  @ApiProperty() shares!: number;
  @ApiProperty({ description: 'Total follows (followers growth signal).' })
  followersGrowth!: number;
}

/** Moderation Analytics (`GET /admin/analytics/moderation`) — reuses report stats. */
export class ModerationAnalyticsDto {
  @ApiProperty({ description: 'Pending + reviewing + appealed.' }) openReports!: number;
  @ApiProperty({ description: 'Resolved + dismissed.' }) closedReports!: number;
  @ApiProperty() appeals!: number;
  @ApiProperty({ nullable: true, description: 'Mean seconds to resolve.' })
  averageResolutionSeconds!: number | null;
  @ApiProperty({ type: [RankedItemDto], description: 'By reason.' })
  topReportReasons!: RankedItemDto[];
  @ApiProperty({ type: [RankedItemDto], description: 'Resolutions per moderator.' })
  moderatorActivity!: RankedItemDto[];
}

/**
 * System Analytics (`GET /admin/analytics/system`). Queue/cache/DB metrics are
 * live-sourced. `apiRequests`/`errorRate` are per-node in-memory counters exposed
 * at `/metrics` (Prometheus) — null here (not aggregated cross-node).
 */
export class SystemAnalyticsDto {
  @ApiProperty({ nullable: true, description: 'Per-node counter — see /metrics.' })
  apiRequests!: number | null;
  @ApiProperty({ nullable: true, description: '5xx rate (0–1) — see /metrics.' })
  errorRate!: number | null;
  @ApiProperty({ type: [QueueStatDto] }) queues!: QueueStatDto[];
  @ApiProperty({ description: 'Total jobs active across queues (≈ busy workers).' })
  activeWorkers!: number;
  @ApiProperty({ description: 'Whether this node runs workers.' }) workersEnabled!: boolean;
  @ApiProperty({ nullable: true, description: 'Redis keyspace hit ratio (0–1).' })
  cacheHitRatio!: number | null;
  @ApiProperty({ nullable: true }) cacheKeys!: number | null;
  @ApiProperty({ nullable: true, description: 'Redis used memory (bytes).' })
  cacheMemoryBytes!: number | null;
  @ApiProperty({ description: 'Database size in bytes.' }) databaseSizeBytes!: number;
  @ApiProperty({ type: [TableSizeDto] }) topTables!: TableSizeDto[];
  @ApiProperty({ description: 'Object-storage (MinIO) usage is not tracked.' })
  storageNote!: string;
}
