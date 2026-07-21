/**
 * Wire + view types for the Operations feature (P7.4). Mirror the backend Operations Platform DTOs
 * exposed under `/api/v1/admin/operations/*`. Hand-authored until `@qalam/api-types` covers them —
 * only the fields the views read are declared (extra response fields are ignored by structural
 * typing). Read views require `admin.dashboard`; mutations require `settings.manage` (the server
 * re-checks every request). Never carries a secret — status/telemetry only.
 */

/** Roll-up operational health (summary + health overall). */
export type OperationalHealth = 'healthy' | 'degraded' | 'unhealthy';

/** `GET /admin/operations/summary` — the single-glance operations roll-up. */
export interface OperationsSummary {
  generatedAt: string;
  health: OperationalHealth;
  ready: boolean;
  slo: { total: number; meeting: number; atRisk: number; breaching: number };
  alerts: { firing: number; suppressed: number };
  incidents: { open: number };
  deployment: { version: string; successRate: number; rollbacks: number };
  reliability: { availabilityRatio: number; mttrMinutes: number | null };
  costDailyUsd: number;
  centralized: boolean;
  controls: string[];
}

/** Operational-health component category (drives grouping + icon). */
export type ComponentCategory =
  'service' | 'dependency' | 'infrastructure' | 'worker' | 'third_party';

/** Per-component operational status. */
export type ComponentStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

/** One operational-health component (backend `HealthComponent`). */
export interface HealthComponent {
  name: string;
  category: ComponentCategory;
  status: ComponentStatus;
  detail: string;
}

/** `GET /admin/operations/health` — operational-health snapshot. */
export interface OperationsHealth {
  generatedAt: string;
  overall: OperationalHealth;
  ready: boolean;
  components: HealthComponent[];
  statusSummary: string;
}

/** One governance control check (backend `GovernanceCheck`). */
export interface GovernanceCheck {
  control: string;
  ok: boolean;
  detail: string;
}

/** Catalogued operations assets (counts). */
export interface GovernanceCatalogues {
  slos: number;
  alertRules: number;
  runbooks: number;
  chaosScenarios: number;
}

/** `GET /admin/operations/governance` — centralization posture + control checks. */
export interface OperationsGovernance {
  generatedAt: string;
  centralized: boolean;
  checks: GovernanceCheck[];
  catalogues: GovernanceCatalogues;
  statement: string;
}

/** Metrics-exposition posture (backend `observability.metrics`). */
export interface ObservabilityMetricsPosture {
  exposed: boolean;
  endpoint: string;
  series: number;
}

/** Structured-logging posture (backend `observability.logging`). */
export interface ObservabilityLoggingPosture {
  structured: boolean;
  format: 'json';
  sampleRate: number;
  retentionDays: number;
  redactionEnforced: boolean;
  classes: string[];
}

/** Tracing posture (backend `observability.tracing`). */
export interface ObservabilityTracingPosture {
  enabled: boolean;
  sampleRate: number;
  tracesRetained: number;
  spansRetained: number;
}

/** `GET /admin/operations/observability` — the observability posture (metrics + logging + tracing). */
export interface OperationsObservability {
  generatedAt: string;
  metrics: ObservabilityMetricsPosture;
  logging: ObservabilityLoggingPosture;
  tracing: ObservabilityTracingPosture;
}

/** One exposed metric series (backend `MetricSeries`). */
export interface MetricSeries {
  name: string;
  value: number | null;
  unit: string;
  source: string;
}

/** `GET /admin/operations/metrics` — the Prometheus-exposition metric registry snapshot. */
export interface OperationsMetrics {
  generatedAt: string;
  registry: string;
  exposition: 'prometheus';
  series: MetricSeries[];
}

/** One span within a trace (backend `TraceSpan`). */
export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  name: string;
  kind: string;
  durationMs: number;
  status: string;
  startedAt: string;
  attributes: Record<string, unknown>;
}

/** Roll-up trace status. */
export type TraceStatus = 'ok' | 'error';

/** `GET /admin/operations/traces[/:id]` — one distributed trace with its spans. */
export interface Trace {
  traceId: string;
  rootName: string;
  spanCount: number;
  durationMs: number;
  status: TraceStatus;
  startedAt: string;
  spans: TraceSpan[];
}

/** Per-objective SLO status. */
export type SloStatus = 'meeting' | 'at_risk' | 'breaching' | 'no_data';

/** One service-level objective (backend `SloObjective`). */
export interface SloObjective {
  id: string;
  service: string;
  label: string;
  kind: string;
  objective: number;
  unit: string;
  comparator: string;
  sli: number | null;
  errorBudgetRemaining: number | null;
  burnRate: number | null;
  status: SloStatus;
}

/** `GET /admin/operations/slo` — SLO objectives with SLI + error-budget + burn-rate. */
export interface OperationsSlo {
  generatedAt: string;
  windowSeconds: number;
  objectives: SloObjective[];
  meeting: number;
  atRisk: number;
  breaching: number;
}

/** Alert-evaluation severity. */
export type AlertSeverity = 'critical' | 'warning' | 'info';

/** One alert-rule evaluation (backend `AlertEvaluation`). */
export interface AlertEvaluation {
  id: string;
  label: string;
  category: string;
  severity: AlertSeverity;
  metric: string;
  threshold: number;
  unit: string;
  measured: number | null;
  firing: boolean;
  runbookId: string | null;
  route: string;
  suppressed: boolean;
  suppressedReason: string | null;
}

/** `GET /admin/operations/alerts` — alert-rule evaluations with firing/suppressed roll-ups. */
export interface OperationsAlerts {
  generatedAt: string;
  firing: number;
  suppressed: number;
  evaluations: AlertEvaluation[];
}

/** Cost-trend direction. */
export type CostTrend = 'rising' | 'stable' | 'falling' | 'unknown';

/** One cost line (backend `CostLine`). */
export interface CostLine {
  category: string;
  label: string;
  dailyUsd: number;
  monthlyUsd: number;
  basis: string;
}

/** `GET /admin/operations/cost` — the cost breakdown with daily/monthly totals + trend. */
export interface OperationsCost {
  generatedAt: string;
  currency: 'USD';
  dailyUsd: number;
  monthlyUsd: number;
  lines: CostLine[];
  trend: CostTrend;
}

/** `GET /admin/operations/reliability` — reliability KPIs over a rolling window. */
export interface OperationsReliability {
  generatedAt: string;
  windowDays: number;
  availabilityRatio: number;
  incidentsTotal: number;
  incidentsResolved: number;
  mttrMinutes: number | null;
  mtbfHours: number | null;
  failuresByClass: Record<string, number>;
  recoveryVerifiedRate: number;
}

/** The running build/instance identity (backend `deployments.current`). */
export interface DeploymentCurrent {
  version: string;
  gitSha: string;
  environment: string;
  releaseChannel: string;
  instanceId: string;
  startedAt: string;
  uptimeSeconds: number;
}

/** One deployment-history record (backend `DeploymentRecord`). */
export interface DeploymentRecord {
  id: string;
  type: string;
  version: string;
  gitSha: string;
  environment: string;
  status: string;
  durationSeconds: number | null;
  at: string;
  actorId: string | null;
  note: string | null;
}

/** `GET /admin/operations/deployments` — current build + deployment history + roll-ups. */
export interface OperationsDeployments {
  generatedAt: string;
  current: DeploymentCurrent;
  totalDeployments: number;
  successRate: number;
  rollbacks: number;
  averageDurationSeconds: number | null;
  recent: DeploymentRecord[];
}

/** Incident severity (sev1 = highest). */
export type IncidentSeverity = 'sev1' | 'sev2' | 'sev3' | 'sev4';

/** Incident lifecycle status. */
export type IncidentStatus =
  'open' | 'acknowledged' | 'investigating' | 'identified' | 'monitoring' | 'resolved';

/** One incident-timeline entry (backend `IncidentTimelineEntry`). */
export interface IncidentTimelineEntry {
  at: string;
  type: string;
  message: string;
  actorId: string | null;
}

/** `GET /admin/operations/incidents[/:id]` — one incident with its timeline. */
export interface Incident {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  service: string | null;
  assigneeId: string | null;
  failureClass: string | null;
  rootCause: string | null;
  sourceAlertId: string | null;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  timeToResolveMinutes: number | null;
  recoveryVerified: boolean;
  timeline: IncidentTimelineEntry[];
}

/**
 * `GET /admin/operations/incidents/:id/postmortem` — a generated postmortem template. The exact
 * field set is owned by the backend, so it's carried as an unknown-valued record and rendered
 * defensively (string/number/array-of-string entries only).
 */
export type IncidentPostmortem = Record<string, unknown>;

/** Feature-rollout strategy. */
export type RolloutStrategy = 'off' | 'full' | 'percentage' | 'canary' | 'environment';

/** One feature rollout (backend `Rollout`). */
export interface Rollout {
  key: string;
  enabled: boolean;
  rolloutPercentage: number;
  environment: string;
  strategy: RolloutStrategy;
  killSwitchEngaged: boolean;
  description: string;
}

/** One runbook (backend `Runbook`). */
export interface Runbook {
  id: string;
  title: string;
  symptom: string;
  severity: string;
  steps: string[];
  linkedAlerts: string[];
}

/** One maintenance window (backend `MaintenanceWindow`). */
export interface MaintenanceWindow {
  id: string;
  reason: string;
  categories: string[];
  startsAt: string;
  endsAt: string;
}

// ── Mutation payloads ────────────────────────────────────────────────────────

/** POST /admin/operations/incidents — declare a new incident. */
export interface CreateIncidentPayload {
  title: string;
  severity: IncidentSeverity;
  service?: string;
}

/** POST /admin/operations/incidents/:id/resolve — resolve with a root cause. */
export interface ResolveIncidentPayload {
  rootCause: string;
  failureClass?: string;
}

/** POST /admin/operations/maintenance-windows — schedule a maintenance window. */
export interface CreateMaintenanceWindowPayload {
  reason: string;
  durationMinutes: number;
  categories?: string[];
}
