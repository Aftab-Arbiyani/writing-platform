import { PERMISSIONS } from '@qalam/shared';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { usePermissions } from '@/hooks/use-permissions';
import { qk } from '@/lib/query-keys';

import { operationsApi } from '../api/operations.api';
import type {
  CreateIncidentPayload,
  CreateMaintenanceWindowPayload,
  Incident,
  IncidentPostmortem,
  IncidentStatus,
  MaintenanceWindow,
  OperationsAlerts,
  OperationsCost,
  OperationsDeployments,
  OperationsGovernance,
  OperationsHealth,
  OperationsMetrics,
  OperationsObservability,
  OperationsReliability,
  OperationsSlo,
  OperationsSummary,
  ResolveIncidentPayload,
  Rollout,
  Runbook,
  Trace,
} from '../types/operations.types';

/**
 * Data hooks for the Operations views (P7.4). Each query keys off `qk.operations.*` and owns its
 * cache so views load independently. Reads are gated on `admin.dashboard`; live surfaces (summary,
 * health, alerts, slo) auto-refresh so operators see current status without a manual reload.
 * Mutations are gated on `settings.manage` at the call site and invalidate the whole namespace.
 */

// ── Reads ──────────────────────────────────────────────────────────────────

export function useOperationsSummary(): UseQueryResult<OperationsSummary, Error> {
  const { can } = usePermissions();
  return useQuery<OperationsSummary, Error>({
    queryKey: qk.operations.summary(),
    queryFn: ({ signal }) => operationsApi.getSummary(signal),
    enabled: can(PERMISSIONS.AdminDashboard),
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}

export function useOperationsHealth(): UseQueryResult<OperationsHealth, Error> {
  const { can } = usePermissions();
  return useQuery<OperationsHealth, Error>({
    queryKey: qk.operations.health(),
    queryFn: ({ signal }) => operationsApi.getHealth(signal),
    enabled: can(PERMISSIONS.AdminDashboard),
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}

export function useOperationsGovernance(): UseQueryResult<OperationsGovernance, Error> {
  const { can } = usePermissions();
  return useQuery<OperationsGovernance, Error>({
    queryKey: qk.operations.governance(),
    queryFn: ({ signal }) => operationsApi.getGovernance(signal),
    enabled: can(PERMISSIONS.AdminDashboard),
    staleTime: 60_000,
  });
}

export function useObservability(): UseQueryResult<OperationsObservability, Error> {
  const { can } = usePermissions();
  return useQuery<OperationsObservability, Error>({
    queryKey: qk.operations.observability(),
    queryFn: ({ signal }) => operationsApi.getObservability(signal),
    enabled: can(PERMISSIONS.AdminDashboard),
    staleTime: 60_000,
  });
}

export function useOperationsMetrics(): UseQueryResult<OperationsMetrics, Error> {
  const { can } = usePermissions();
  return useQuery<OperationsMetrics, Error>({
    queryKey: qk.operations.metrics(),
    queryFn: ({ signal }) => operationsApi.getMetrics(signal),
    enabled: can(PERMISSIONS.AdminDashboard),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useTraces(): UseQueryResult<Trace[], Error> {
  const { can } = usePermissions();
  return useQuery<Trace[], Error>({
    queryKey: qk.operations.traces(),
    queryFn: ({ signal }) => operationsApi.getTraces(signal),
    enabled: can(PERMISSIONS.AdminDashboard),
    staleTime: 15_000,
  });
}

export function useSlo(): UseQueryResult<OperationsSlo, Error> {
  const { can } = usePermissions();
  return useQuery<OperationsSlo, Error>({
    queryKey: qk.operations.slo(),
    queryFn: ({ signal }) => operationsApi.getSlo(signal),
    enabled: can(PERMISSIONS.AdminDashboard),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useAlerts(): UseQueryResult<OperationsAlerts, Error> {
  const { can } = usePermissions();
  return useQuery<OperationsAlerts, Error>({
    queryKey: qk.operations.alerts(),
    queryFn: ({ signal }) => operationsApi.getAlerts(signal),
    enabled: can(PERMISSIONS.AdminDashboard),
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}

export function useCost(): UseQueryResult<OperationsCost, Error> {
  const { can } = usePermissions();
  return useQuery<OperationsCost, Error>({
    queryKey: qk.operations.cost(),
    queryFn: ({ signal }) => operationsApi.getCost(signal),
    enabled: can(PERMISSIONS.AdminDashboard),
    staleTime: 60_000,
  });
}

export function useReliability(): UseQueryResult<OperationsReliability, Error> {
  const { can } = usePermissions();
  return useQuery<OperationsReliability, Error>({
    queryKey: qk.operations.reliability(),
    queryFn: ({ signal }) => operationsApi.getReliability(signal),
    enabled: can(PERMISSIONS.AdminDashboard),
    staleTime: 60_000,
  });
}

export function useDeployments(): UseQueryResult<OperationsDeployments, Error> {
  const { can } = usePermissions();
  return useQuery<OperationsDeployments, Error>({
    queryKey: qk.operations.deployments(),
    queryFn: ({ signal }) => operationsApi.getDeployments(signal),
    enabled: can(PERMISSIONS.AdminDashboard),
    staleTime: 30_000,
  });
}

export function useIncidents(): UseQueryResult<Incident[], Error> {
  const { can } = usePermissions();
  return useQuery<Incident[], Error>({
    queryKey: qk.operations.incidents(),
    queryFn: ({ signal }) => operationsApi.getIncidents(signal),
    enabled: can(PERMISSIONS.AdminDashboard),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

/** One incident's detail (drawer). `enabled` only when a row is selected. */
export function useIncident(id: string | null): UseQueryResult<Incident, Error> {
  const { can } = usePermissions();
  return useQuery<Incident, Error>({
    queryKey: qk.operations.incident(id ?? ''),
    queryFn: ({ signal }) => operationsApi.getIncident(id ?? '', signal),
    enabled: id !== null && can(PERMISSIONS.AdminDashboard),
    staleTime: 10_000,
  });
}

/** A generated postmortem template for a resolved incident. Fetched on demand (tab open). */
export function useIncidentPostmortem(
  id: string | null,
  enabled: boolean,
): UseQueryResult<IncidentPostmortem, Error> {
  const { can } = usePermissions();
  return useQuery<IncidentPostmortem, Error>({
    queryKey: qk.operations.incidentPostmortem(id ?? ''),
    queryFn: ({ signal }) => operationsApi.getIncidentPostmortem(id ?? '', signal),
    enabled: id !== null && enabled && can(PERMISSIONS.AdminDashboard),
    staleTime: 60_000,
  });
}

export function useRollouts(): UseQueryResult<Rollout[], Error> {
  const { can } = usePermissions();
  return useQuery<Rollout[], Error>({
    queryKey: qk.operations.rollouts(),
    queryFn: ({ signal }) => operationsApi.getRollouts(signal),
    enabled: can(PERMISSIONS.AdminDashboard),
    staleTime: 30_000,
  });
}

export function useRunbooks(): UseQueryResult<Runbook[], Error> {
  const { can } = usePermissions();
  return useQuery<Runbook[], Error>({
    queryKey: qk.operations.runbooks(),
    queryFn: ({ signal }) => operationsApi.getRunbooks(signal),
    enabled: can(PERMISSIONS.AdminDashboard),
    staleTime: 5 * 60_000,
  });
}

export function useMaintenanceWindows(): UseQueryResult<MaintenanceWindow[], Error> {
  const { can } = usePermissions();
  return useQuery<MaintenanceWindow[], Error>({
    queryKey: qk.operations.maintenanceWindows(),
    queryFn: ({ signal }) => operationsApi.getMaintenanceWindows(signal),
    enabled: can(PERMISSIONS.AdminDashboard),
    staleTime: 30_000,
  });
}

// ── Mutations (settings.manage) ──────────────────────────────────────────────

/** Any operations mutation refreshes the whole namespace so every dependent view re-reads. */
function useInvalidate(): () => void {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: qk.operations.all });
}

export function useCreateIncident(): UseMutationResult<Incident, Error, CreateIncidentPayload> {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (payload) => operationsApi.createIncident(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateIncidentStatus(): UseMutationResult<
  Incident,
  Error,
  { id: string; status: IncidentStatus }
> {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, status }) => operationsApi.updateIncidentStatus(id, status),
    onSuccess: invalidate,
  });
}

export function useAddIncidentNote(): UseMutationResult<
  Incident,
  Error,
  { id: string; message: string }
> {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, message }) => operationsApi.addIncidentNote(id, message),
    onSuccess: invalidate,
  });
}

export function useResolveIncident(): UseMutationResult<
  Incident,
  Error,
  { id: string; payload: ResolveIncidentPayload }
> {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, payload }) => operationsApi.resolveIncident(id, payload),
    onSuccess: invalidate,
  });
}

export function useSetRolloutPercentage(): UseMutationResult<
  Rollout,
  Error,
  { key: string; percentage: number }
> {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ key, percentage }) => operationsApi.setRolloutPercentage(key, percentage),
    onSuccess: invalidate,
  });
}

export function useKillRollout(): UseMutationResult<Rollout, Error, { key: string }> {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ key }) => operationsApi.killRollout(key),
    onSuccess: invalidate,
  });
}

export function useCreateMaintenanceWindow(): UseMutationResult<
  MaintenanceWindow,
  Error,
  CreateMaintenanceWindowPayload
> {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (payload) => operationsApi.createMaintenanceWindow(payload),
    onSuccess: invalidate,
  });
}
