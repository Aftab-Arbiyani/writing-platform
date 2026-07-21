import { api } from '@/lib/api-client';

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
 * The Operations feature's `api/` layer (P7.4) — the only place its endpoints are named. Every read
 * and mutation goes through the shared api-client (Bearer + `{success,data,meta}` envelope unwrap).
 * Reads require `admin.dashboard`; mutations require `settings.manage` (the server re-checks). All
 * endpoints mount under `/admin/operations/*` (the api-client adds the `/api/v1` prefix).
 */
export const operationsApi = {
  // ── Reads ──────────────────────────────────────────────────────────────────
  getSummary: (signal?: AbortSignal): Promise<OperationsSummary> =>
    api.get<OperationsSummary>('/admin/operations/summary', { signal }).then((r) => r.data),

  getHealth: (signal?: AbortSignal): Promise<OperationsHealth> =>
    api.get<OperationsHealth>('/admin/operations/health', { signal }).then((r) => r.data),

  getGovernance: (signal?: AbortSignal): Promise<OperationsGovernance> =>
    api.get<OperationsGovernance>('/admin/operations/governance', { signal }).then((r) => r.data),

  getObservability: (signal?: AbortSignal): Promise<OperationsObservability> =>
    api
      .get<OperationsObservability>('/admin/operations/observability', { signal })
      .then((r) => r.data),

  getMetrics: (signal?: AbortSignal): Promise<OperationsMetrics> =>
    api.get<OperationsMetrics>('/admin/operations/metrics', { signal }).then((r) => r.data),

  getTraces: (signal?: AbortSignal): Promise<Trace[]> =>
    api.get<Trace[]>('/admin/operations/traces', { signal }).then((r) => r.data),

  getTrace: (traceId: string, signal?: AbortSignal): Promise<Trace> =>
    api.get<Trace>(`/admin/operations/traces/${traceId}`, { signal }).then((r) => r.data),

  getSlo: (signal?: AbortSignal): Promise<OperationsSlo> =>
    api.get<OperationsSlo>('/admin/operations/slo', { signal }).then((r) => r.data),

  getAlerts: (signal?: AbortSignal): Promise<OperationsAlerts> =>
    api.get<OperationsAlerts>('/admin/operations/alerts', { signal }).then((r) => r.data),

  getCost: (signal?: AbortSignal): Promise<OperationsCost> =>
    api.get<OperationsCost>('/admin/operations/cost', { signal }).then((r) => r.data),

  getReliability: (signal?: AbortSignal): Promise<OperationsReliability> =>
    api.get<OperationsReliability>('/admin/operations/reliability', { signal }).then((r) => r.data),

  getDeployments: (signal?: AbortSignal): Promise<OperationsDeployments> =>
    api.get<OperationsDeployments>('/admin/operations/deployments', { signal }).then((r) => r.data),

  getIncidents: (signal?: AbortSignal): Promise<Incident[]> =>
    api.get<Incident[]>('/admin/operations/incidents', { signal }).then((r) => r.data),

  getIncident: (id: string, signal?: AbortSignal): Promise<Incident> =>
    api.get<Incident>(`/admin/operations/incidents/${id}`, { signal }).then((r) => r.data),

  getIncidentPostmortem: (id: string, signal?: AbortSignal): Promise<IncidentPostmortem> =>
    api
      .get<IncidentPostmortem>(`/admin/operations/incidents/${id}/postmortem`, { signal })
      .then((r) => r.data),

  getRollouts: (signal?: AbortSignal): Promise<Rollout[]> =>
    api.get<Rollout[]>('/admin/operations/rollouts', { signal }).then((r) => r.data),

  getRunbooks: (signal?: AbortSignal): Promise<Runbook[]> =>
    api.get<Runbook[]>('/admin/operations/runbooks', { signal }).then((r) => r.data),

  getMaintenanceWindows: (signal?: AbortSignal): Promise<MaintenanceWindow[]> =>
    api
      .get<MaintenanceWindow[]>('/admin/operations/maintenance-windows', { signal })
      .then((r) => r.data),

  // ── Mutations (settings.manage) ──────────────────────────────────────────────
  createIncident: (payload: CreateIncidentPayload): Promise<Incident> =>
    api.post<Incident>('/admin/operations/incidents', payload).then((r) => r.data),

  updateIncidentStatus: (id: string, status: IncidentStatus): Promise<Incident> =>
    api.patch<Incident>(`/admin/operations/incidents/${id}/status`, { status }).then((r) => r.data),

  addIncidentNote: (id: string, message: string): Promise<Incident> =>
    api.post<Incident>(`/admin/operations/incidents/${id}/notes`, { message }).then((r) => r.data),

  resolveIncident: (id: string, payload: ResolveIncidentPayload): Promise<Incident> =>
    api.post<Incident>(`/admin/operations/incidents/${id}/resolve`, payload).then((r) => r.data),

  setRolloutPercentage: (key: string, percentage: number): Promise<Rollout> =>
    api
      .patch<Rollout>(`/admin/operations/rollouts/${key}/percentage`, { percentage })
      .then((r) => r.data),

  killRollout: (key: string): Promise<Rollout> =>
    api.post<Rollout>(`/admin/operations/rollouts/${key}/kill`, {}).then((r) => r.data),

  createMaintenanceWindow: (payload: CreateMaintenanceWindowPayload): Promise<MaintenanceWindow> =>
    api
      .post<MaintenanceWindow>('/admin/operations/maintenance-windows', payload)
      .then((r) => r.data),
};
