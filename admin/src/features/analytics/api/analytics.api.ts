import { env } from '@/config/env';
import { api, getAccessToken } from '@/lib/api-client';

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
export async function downloadAnalyticsExport(
  filters: AnalyticsFilters,
  dataset: AnalyticsDataset,
  format: 'csv' | 'json',
  signal?: AbortSignal,
): Promise<void> {
  const search = new URLSearchParams({ ...toQuery(filters), dataset, format } as Record<
    string,
    string
  >);
  const token = getAccessToken();
  const response = await fetch(`${env.VITE_API_URL}/admin/analytics/export?${search.toString()}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: format === 'json' ? 'application/json' : 'text/csv',
      ...(token !== null ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Export failed (${response.status})`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `qalam-analytics-${dataset}-${new Date().toISOString().slice(0, 10)}.${format}`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
