import { PERMISSIONS } from '@qalam/shared';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { usePermissions } from '@/hooks/use-permissions';
import { qk } from '@/lib/query-keys';

import { securityApi } from '../api/security.api';
import type {
  ComplianceReport,
  KeyStatusReport,
  RetentionReport,
  SecurityStatus,
} from '../types/security.types';

/**
 * Data hooks for the Security / Compliance / Privacy views (P7.2). Each query keys off
 * `qk.security.*` / `qk.compliance.*` and owns its own cache so views load independently. All reads
 * are gated on `admin.dashboard` (the server re-checks). Posture rarely changes minute-to-minute, so
 * a modest staleTime keeps reloads cheap without going stale on an active operator.
 */

/** `GET /admin/security/status` — controls, lockout + threat policy, encryption posture. */
export function useSecurityStatus(): UseQueryResult<SecurityStatus, Error> {
  const { can } = usePermissions();
  return useQuery<SecurityStatus, Error>({
    queryKey: qk.security.status(),
    queryFn: ({ signal }) => securityApi.getSecurityStatus(signal),
    enabled: can(PERMISSIONS.AdminDashboard),
    staleTime: 30_000,
  });
}

/** `GET /admin/security/keys` — rotation policy + per-key non-secret status. */
export function useKeyStatuses(): UseQueryResult<KeyStatusReport, Error> {
  const { can } = usePermissions();
  return useQuery<KeyStatusReport, Error>({
    queryKey: qk.security.keys(),
    queryFn: ({ signal }) => securityApi.getKeyStatuses(signal),
    enabled: can(PERMISSIONS.AdminDashboard),
    staleTime: 30_000,
  });
}

/** `GET /admin/compliance/report` — full compliance snapshot (posture + audit + retention + frameworks). */
export function useComplianceReport(): UseQueryResult<ComplianceReport, Error> {
  const { can } = usePermissions();
  return useQuery<ComplianceReport, Error>({
    queryKey: qk.compliance.report(),
    queryFn: ({ signal }) => securityApi.getComplianceReport(signal),
    enabled: can(PERMISSIONS.AdminDashboard),
    staleTime: 30_000,
  });
}

/** `GET /admin/compliance/retention` — frameworks + data-retention registry (Compliance + Privacy). */
export function useRetention(): UseQueryResult<RetentionReport, Error> {
  const { can } = usePermissions();
  return useQuery<RetentionReport, Error>({
    queryKey: qk.compliance.retention(),
    queryFn: ({ signal }) => securityApi.getRetention(signal),
    enabled: can(PERMISSIONS.AdminDashboard),
    staleTime: 60_000,
  });
}
