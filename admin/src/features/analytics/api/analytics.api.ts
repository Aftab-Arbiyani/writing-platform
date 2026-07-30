import { api } from '@/lib/api-client';
import { downloadExport, exportFilename } from '@/lib/download-export';

import type {
  AnalyticsDataset,
  AnalyticsFilters,
  ContentAnalytics,
  EngagementAnalytics,
  ModerationAnalytics,
  ModerationTrends,
  PlatformOverview,
  SystemAnalytics,
  Trending,
  UserAnalytics,
} from '../types/analytics.types';

/** Folds the analytics filters into an api-client query object (skips empties). */
export function toQuery(filters: AnalyticsFilters): Record<string, string | number> {
  const query: Record<string, string | number> = { range: filters.range };
  if (filters.range === 'custom') {
    if (filters.from !== undefined) query.from = filters.from;
    if (filters.to !== undefined) query.to = filters.to;
  }
  for (const key of ['language', 'genre', 'country', 'platform'] as const) {
    const value = filters[key];
    if (value !== undefined && value !== '') query[key] = value;
  }
  return query;
}

/**
 * The Analytics feature's `api/` layer — the only place `/admin/analytics/*` is
 * named (docs 26 §7). Integrates ONLY with the E12.9 endpoints plus the existing
 * `/analytics/trending` (trending writers/tags) and `/admin/reports/trends`
 * (moderation trend). All go through the shared api-client — no mock data.
 */
export const analyticsApi = {
  overview: (filters: AnalyticsFilters, signal?: AbortSignal): Promise<PlatformOverview> =>
    api
      .get<PlatformOverview>('/admin/analytics/overview', { query: toQuery(filters), signal })
      .then((r) => r.data),

  users: (filters: AnalyticsFilters, signal?: AbortSignal): Promise<UserAnalytics> =>
    api
      .get<UserAnalytics>('/admin/analytics/users', { query: toQuery(filters), signal })
      .then((r) => r.data),

  content: (filters: AnalyticsFilters, signal?: AbortSignal): Promise<ContentAnalytics> =>
    api
      .get<ContentAnalytics>('/admin/analytics/content', { query: toQuery(filters), signal })
      .then((r) => r.data),

  engagement: (filters: AnalyticsFilters, signal?: AbortSignal): Promise<EngagementAnalytics> =>
    api
      .get<EngagementAnalytics>('/admin/analytics/engagement', { query: toQuery(filters), signal })
      .then((r) => r.data),

  moderation: (filters: AnalyticsFilters, signal?: AbortSignal): Promise<ModerationAnalytics> =>
    api
      .get<ModerationAnalytics>('/admin/analytics/moderation', { query: toQuery(filters), signal })
      .then((r) => r.data),

  system: (signal?: AbortSignal): Promise<SystemAnalytics> =>
    api.get<SystemAnalytics>('/admin/analytics/system', { signal }).then((r) => r.data),

  // ── Reused existing endpoints ────────────────────────────────────────────────
  trending: (signal?: AbortSignal): Promise<Trending> =>
    api
      .get<Trending>('/analytics/trending', { query: { period: 'weekly', limit: 10 }, signal })
      .then((r) => r.data),

  moderationTrends: (signal?: AbortSignal): Promise<ModerationTrends> =>
    api.get<ModerationTrends>('/admin/reports/trends', { signal }).then((r) => r.data),
};

/**
 * Streams one analytics dataset to a file download (E12.9 export). The export
 * returns a RAW CSV/JSON stream (not the `{success,data}` envelope), so it
 * bypasses the api-client and hits `fetch` directly with the same Bearer token.
 */
export function downloadAnalyticsExport(
  filters: AnalyticsFilters,
  dataset: AnalyticsDataset,
  format: 'csv' | 'json',
  signal?: AbortSignal,
): Promise<void> {
  return downloadExport({
    path: '/admin/analytics/export',
    query: { ...toQuery(filters), dataset },
    format,
    filename: exportFilename(`analytics-${dataset}`, format),
    signal,
  });
}
