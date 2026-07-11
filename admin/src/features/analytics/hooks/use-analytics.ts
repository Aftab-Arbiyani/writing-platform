import { PERMISSIONS } from '@qalam/shared';
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { usePermissions } from '@/hooks/use-permissions';
import { qk } from '@/lib/query-keys';

import { analyticsApi } from '../api/analytics.api';
import type {
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

/**
 * One query per analytics section (E12.9) — independent caches so sections fetch
 * in parallel and cache separately (docs 24 perf). All gated on `analytics.view`
 * (admin+); `keepPreviousData` keeps the last view on screen while a new range
 * loads. A section is only fetched when its view is mounted (lazy per tab).
 */

function useAnalyticsEnabled(enabled: boolean): boolean {
  const { can } = usePermissions();
  return enabled && can(PERMISSIONS.AnalyticsView);
}

export function useOverview(
  filters: AnalyticsFilters,
  enabled = true,
): UseQueryResult<PlatformOverview, Error> {
  return useQuery<PlatformOverview, Error>({
    queryKey: qk.analytics.overview(filters),
    queryFn: ({ signal }) => analyticsApi.overview(filters, signal),
    enabled: useAnalyticsEnabled(enabled),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useUserAnalytics(
  filters: AnalyticsFilters,
  enabled = true,
): UseQueryResult<UserAnalytics, Error> {
  return useQuery<UserAnalytics, Error>({
    queryKey: qk.analytics.users(filters),
    queryFn: ({ signal }) => analyticsApi.users(filters, signal),
    enabled: useAnalyticsEnabled(enabled),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useContentAnalytics(
  filters: AnalyticsFilters,
  enabled = true,
): UseQueryResult<ContentAnalytics, Error> {
  return useQuery<ContentAnalytics, Error>({
    queryKey: qk.analytics.content(filters),
    queryFn: ({ signal }) => analyticsApi.content(filters, signal),
    enabled: useAnalyticsEnabled(enabled),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useEngagementAnalytics(
  filters: AnalyticsFilters,
  enabled = true,
): UseQueryResult<EngagementAnalytics, Error> {
  return useQuery<EngagementAnalytics, Error>({
    queryKey: qk.analytics.engagement(filters),
    queryFn: ({ signal }) => analyticsApi.engagement(filters, signal),
    enabled: useAnalyticsEnabled(enabled),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useModerationAnalytics(
  filters: AnalyticsFilters,
  enabled = true,
): UseQueryResult<ModerationAnalytics, Error> {
  return useQuery<ModerationAnalytics, Error>({
    queryKey: qk.analytics.moderation(filters),
    queryFn: ({ signal }) => analyticsApi.moderation(filters, signal),
    enabled: useAnalyticsEnabled(enabled),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useSystemAnalytics(enabled = true): UseQueryResult<SystemAnalytics, Error> {
  return useQuery<SystemAnalytics, Error>({
    queryKey: qk.analytics.system(),
    queryFn: ({ signal }) => analyticsApi.system(signal),
    enabled: useAnalyticsEnabled(enabled),
    // System metrics change fast; keep a short stale window + poll while viewed.
    staleTime: 15_000,
    refetchInterval: enabled ? 30_000 : false,
  });
}

/** Trending writers/tags for the content view (reuses `/analytics/trending`). */
export function useTrending(enabled = true): UseQueryResult<Trending, Error> {
  return useQuery<Trending, Error>({
    queryKey: qk.analytics.trending(),
    queryFn: ({ signal }) => analyticsApi.trending(signal),
    enabled: useAnalyticsEnabled(enabled),
    staleTime: 120_000,
  });
}

/** Moderation trend series for the moderation view (reuses `/admin/reports/trends`). */
export function useModerationTrends(enabled = true): UseQueryResult<ModerationTrends, Error> {
  return useQuery<ModerationTrends, Error>({
    queryKey: qk.analytics.moderationTrends(),
    queryFn: ({ signal }) => analyticsApi.moderationTrends(signal),
    enabled: useAnalyticsEnabled(enabled),
    staleTime: 60_000,
  });
}
