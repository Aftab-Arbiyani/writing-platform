/**
 * Wire types for the Platform Analytics dashboard (A8), mirroring the E12.9
 * backend DTOs (`backend/src/modules/analytics/dto/admin-analytics-response.dto`)
 * plus the reused trending (`/analytics/trending`) and moderation-trends
 * (`/admin/reports/trends`) contracts. Hand-authored until `@qalam/api-types`
 * regenerates — TODO(aftab): drop for generated types once `openapi.json` covers them.
 */

export interface RankedItem {
  key: string;
  label: string;
  count: number;
}

export interface SeriesPoint {
  date: string;
  count: number;
}

/** Trend-range presets (match the backend `AdminTrendRange`). */
export type TrendRange = 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'year' | 'custom';

/** Shared analytics filters (drive the query string). A type (not interface) so
 * it stays assignable to the `Record<string, unknown>` query-key factories. */
export type AnalyticsFilters = {
  range: TrendRange;
  from?: string;
  to?: string;
  language?: string;
  genre?: string;
  country?: string;
  platform?: string;
};

export interface PlatformOverview {
  totalUsers: number;
  verifiedUsers: number;
  activeUsers: number;
  newUsers: number;
  privateAccounts: number;
  publishedPieces: number;
  drafts: number;
  comments: number;
  responses: number;
  reports: number;
  resolvedReports: number;
  bookmarks: number;
  claps: number;
  followers: number;
  databaseSizeBytes: number;
  growthRatePct: number;
  generatedAt: string;
}

export interface UserAnalytics {
  registrations: number;
  activeUsers: number;
  retentionPct: number;
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  topCountries: RankedItem[];
  topLanguages: RankedItem[];
  topDevices: RankedItem[];
  registrationsSeries: SeriesPoint[];
}

export interface ContentAnalytics {
  publishedPieces: number;
  drafts: number;
  piecesPerLanguage: RankedItem[];
  piecesPerGenre: RankedItem[];
  averageReadingSeconds: number;
  averageCompletionRate: number;
  mostViewedPieces: RankedItem[];
  mostSharedPieces: RankedItem[];
}

export interface EngagementAnalytics {
  views: number;
  reads: number;
  readingSeconds: number;
  completionRate: number;
  bookmarks: number;
  claps: number;
  comments: number;
  responses: number;
  shares: number;
  followersGrowth: number;
}

export interface ModerationAnalytics {
  openReports: number;
  closedReports: number;
  appeals: number;
  averageResolutionSeconds: number | null;
  topReportReasons: RankedItem[];
  moderatorActivity: RankedItem[];
}

export interface QueueStat {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export interface TableSize {
  table: string;
  bytes: number;
}

export interface SystemAnalytics {
  apiRequests: number | null;
  errorRate: number | null;
  queues: QueueStat[];
  activeWorkers: number;
  workersEnabled: boolean;
  cacheHitRatio: number | null;
  cacheKeys: number | null;
  cacheMemoryBytes: number | null;
  databaseSizeBytes: number;
  topTables: TableSize[];
  storageNote: string;
}

/** `/analytics/trending` — reused for trending writers + tags on the content view. */
export interface Trending {
  period: string;
  pieces: RankedItem[];
  writers: RankedItem[];
  genres: RankedItem[];
  tags: RankedItem[];
}

/** `/admin/reports/trends` — reused for the moderation trend chart. */
export interface ModerationTrends {
  from: string;
  to: string;
  points: Array<{ date: string; created: number; resolved: number }>;
}

/** The datasets the export endpoint accepts. */
export type AnalyticsDataset =
  'overview' | 'users' | 'content' | 'engagement' | 'moderation' | 'system';
