import type { HealthStatus } from '@/components/status-indicator';

/**
 * Dashboard wire types — subsets of the real backend DTOs the dashboard consumes (hand-declared;
 * `@qalam/api-types` has no generated types yet). Only the fields the dashboard reads are declared;
 * extra response fields are ignored by structural typing.
 */

/** Subset of `PlatformAnalyticsDto` (GET /analytics/platform). */
export interface PlatformStats {
  totalUsers: number;
  dailyActiveUsers: number;
  monthlyActiveUsers: number;
  newRegistrations: number;
  publishedPieces: number;
  draftPieces: number;
  comments: number;
  claps: number;
  bookmarks: number;
  collections: number;
  views: number;
  reads: number;
}

/** `QueueStatusDto` (GET /admin/queues). */
export interface QueueCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export interface QueueStatus {
  name: string;
  paused: boolean;
  counts: QueueCounts;
  oldestWaitingAgeMs: number;
  workers: number;
}

/** `SystemNotificationDto` (GET /admin/system-notifications). */
export interface SystemNotification {
  id: string;
  title: string;
  body: string;
  audience: string;
  createdBy: string | null;
  createdAt: string;
  deliveredCount: number;
}

/** Normalized system-health snapshot derived from the public `/health/*` probes. */
export interface SystemHealth {
  api: HealthStatus;
  database: HealthStatus;
  redis: HealthStatus;
  queues: HealthStatus;
  storage: HealthStatus;
}
