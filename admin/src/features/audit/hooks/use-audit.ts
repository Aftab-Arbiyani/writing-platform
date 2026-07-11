import { PERMISSIONS } from '@qalam/shared';
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { usePermissions } from '@/hooks/use-permissions';
import { qk } from '@/lib/query-keys';

import { auditApi, type AuditPage } from '../api/audit.api';
import type { AuditListParams, AuditLog, AuditStatistics } from '../types/audit.types';

/** The audit-log browser (`GET /admin/audit-logs`). Gated on `admin.dashboard` (admin+). */
export function useAuditLogs(params: AuditListParams): UseQueryResult<AuditPage, Error> {
  const { can } = usePermissions();
  return useQuery<AuditPage, Error>({
    queryKey: qk.audit.list(params),
    queryFn: ({ signal }) => auditApi.list(params, signal),
    enabled: can(PERMISSIONS.AdminDashboard),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

/** One audit entry (`GET /admin/audit-logs/:id`); disabled until a row is opened. */
export function useAuditEntry(id: string | null): UseQueryResult<AuditLog, Error> {
  const { can } = usePermissions();
  return useQuery<AuditLog, Error>({
    queryKey: qk.audit.detail(id ?? 'none'),
    queryFn: ({ signal }) => auditApi.detail(id ?? '', signal),
    enabled: id !== null && can(PERMISSIONS.AdminDashboard),
    staleTime: 60_000,
  });
}

/** Global audit statistics (`GET /admin/audit-logs/statistics`). */
export function useAuditStatistics(): UseQueryResult<AuditStatistics, Error> {
  const { can } = usePermissions();
  return useQuery<AuditStatistics, Error>({
    queryKey: qk.audit.statistics(),
    queryFn: ({ signal }) => auditApi.statistics(signal),
    enabled: can(PERMISSIONS.AdminDashboard),
    staleTime: 60_000,
  });
}
