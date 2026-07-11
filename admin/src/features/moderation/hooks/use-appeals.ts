import { PERMISSIONS } from '@qalam/shared';
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { usePermissions } from '@/hooks/use-permissions';
import { qk } from '@/lib/query-keys';

import { moderationApi, type AppealPage } from '../api/moderation.api';
import type { AppealDetail, AppealListParams } from '../types/moderation.types';

/** The appeal queue (`GET /admin/appeals`). Gated on `report.review`. */
export function useAppeals(params: AppealListParams): UseQueryResult<AppealPage, Error> {
  const { can } = usePermissions();
  return useQuery<AppealPage, Error>({
    queryKey: qk.moderation.appeals(params),
    queryFn: ({ signal }) => moderationApi.listAppeals(params, signal),
    enabled: can(PERMISSIONS.ReportReview),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

/** Full appeal detail (`GET /admin/appeals/:id`); disabled until an appeal is opened. */
export function useAppeal(id: string | null): UseQueryResult<AppealDetail, Error> {
  const { can } = usePermissions();
  return useQuery<AppealDetail, Error>({
    queryKey: qk.moderation.appeal(id ?? 'none'),
    queryFn: ({ signal }) => moderationApi.appeal(id ?? '', signal),
    enabled: id !== null && can(PERMISSIONS.ReportReview),
    staleTime: 20_000,
  });
}
