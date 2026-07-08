/**
 * Analytics vocabulary (E10). Aggregates are the source of truth for the public
 * APIs (the event listener updates them synchronously); raw events are only kept
 * for view/read dedup + optional future archival (a data warehouse is the scale
 * path — docs 04 §3.9's partitioned `analytics_events` + rollup job). No AI, no
 * background jobs in this MVP.
 */

/** Snapshot / trend windows. */
export const AnalyticsPeriod = {
  Daily: 'daily',
  Weekly: 'weekly',
  Monthly: 'monthly',
} as const;
export type AnalyticsPeriod = (typeof AnalyticsPeriod)[keyof typeof AnalyticsPeriod];

/** What a snapshot row (or a trend list) is about. */
export const AnalyticsScope = {
  Piece: 'piece',
  Writer: 'writer',
  Platform: 'platform',
  Reader: 'reader',
} as const;
export type AnalyticsScope = (typeof AnalyticsScope)[keyof typeof AnalyticsScope];

/** `GET /analytics/trending?type=` — which entity to rank. */
export const TrendType = {
  Pieces: 'pieces',
  Writers: 'writers',
  Genres: 'genres',
  Tags: 'tags',
} as const;
export type TrendType = (typeof TrendType)[keyof typeof TrendType];

/**
 * A countable view is recorded at most once per viewer per piece within this
 * window (dedup "by viewer/day", docs 04 §3.14). Refresh-spamming can't inflate
 * views. Enforced via a Redis cooldown key.
 */
export const VIEW_DEDUP_COOLDOWN_SECONDS = 24 * 60 * 60;

/**
 * A read "counts as completed" when the reader dwelt ≥30 s AND scrolled ≥50 %
 * (docs 04 §3.14 read definition). The client reports duration + completion; the
 * server applies the thresholds.
 */
export const READ_MIN_DWELL_SECONDS = 30;
export const READ_MIN_COMPLETION_PCT = 50;
