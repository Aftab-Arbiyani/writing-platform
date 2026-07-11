import { PERMISSIONS } from '@qalam/shared';
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { usePermissions } from '@/hooks/use-permissions';
import { qk } from '@/lib/query-keys';

import { moderationApi, type ReportPage } from '../api/moderation.api';
import type {
  Moderator,
  ReportDetail,
  ReportListParams,
  ReportStatistics,
  ReportTimelineEntry,
  ReportTrends,
} from '../types/moderation.types';

/** The report queue (`GET /admin/reports`). Gated on `report.review`. */
export function useReports(params: ReportListParams): UseQueryResult<ReportPage, Error> {
  const { can } = usePermissions();
  return useQuery<ReportPage, Error>({
    queryKey: qk.moderation.reports(params),
    queryFn: ({ signal }) => moderationApi.listReports(params, signal),
    enabled: can(PERMISSIONS.ReportReview),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

/** Full report detail (`GET /admin/reports/:id`); disabled until a report is opened. */
export function useReport(id: string | null): UseQueryResult<ReportDetail, Error> {
  const { can } = usePermissions();
  return useQuery<ReportDetail, Error>({
    queryKey: qk.moderation.report(id ?? 'none'),
    queryFn: ({ signal }) => moderationApi.report(id ?? '', signal),
    enabled: id !== null && can(PERMISSIONS.ReportReview),
    staleTime: 20_000,
  });
}

/** Report statistics (`GET /admin/reports/statistics`, E12.7). */
export function useReportStatistics(): UseQueryResult<ReportStatistics, Error> {
  const { can } = usePermissions();
  return useQuery<ReportStatistics, Error>({
    queryKey: qk.moderation.reportStatistics(),
    queryFn: ({ signal }) => moderationApi.statistics(signal),
    enabled: can(PERMISSIONS.ReportReview),
    staleTime: 60_000,
  });
}

/** Report trends over a window (`GET /admin/reports/trends`, E12.7). */
export function useReportTrends(params: {
  from?: string;
  to?: string;
}): UseQueryResult<ReportTrends, Error> {
  const { can } = usePermissions();
  return useQuery<ReportTrends, Error>({
    queryKey: qk.moderation.reportTrends(params),
    queryFn: ({ signal }) => moderationApi.trends(params, signal),
    enabled: can(PERMISSIONS.ReportReview),
    staleTime: 60_000,
  });
}

/** A report's chronological timeline (`GET /admin/reports/:id/timeline`, E12.7). */
export function useReportTimeline(
  id: string | null,
  enabled = true,
): UseQueryResult<ReportTimelineEntry[], Error> {
  const { can } = usePermissions();
  return useQuery<ReportTimelineEntry[], Error>({
    queryKey: qk.moderation.reportTimeline(id ?? 'none'),
    queryFn: ({ signal }) => moderationApi.timeline(id ?? '', signal),
    enabled: id !== null && enabled && can(PERMISSIONS.ReportReview),
    staleTime: 20_000,
  });
}

/**
 * Assignable moderators/admins (for assignment + the assignee filter). Sourced
 * from `/admin/users?role=`, which requires `user.view` (admin-only) — so this is
 * gated on `user.view` to avoid a doomed 403 for moderators (who can still resolve
 * reports; only assignment/assignee-filtering is admin-scoped).
 */
export function useModerators(): UseQueryResult<Moderator[], Error> {
  const { can } = usePermissions();
  return useQuery<Moderator[], Error>({
    queryKey: qk.moderation.moderators(),
    queryFn: ({ signal }) => moderationApi.moderators(signal),
    enabled: can(PERMISSIONS.UserView),
    staleTime: 300_000,
  });
}
