/**
 * Operations Platform vocabulary (P7.4) — the SINGLE SOURCE OF TRUTH for SLOs,
 * alert rules, incident lifecycle, cost categories, runbooks, chaos scenarios,
 * and the operational metric / redis / log taxonomies. Centralizing them here is
 * the whole point of the platform: business services carry no operational
 * thresholds, alerting, or SLO logic; they emit signals and the platform
 * evaluates them against these declarations. Adding an SLO / alert / runbook is
 * adding a row — never touching an engine (the Policy-Engine / P7.3-budget
 * pattern).
 *
 * Nothing here is a secret. Numeric targets are informed by docs 05 (API
 * standards), docs 14 (monitoring), and the P7.3 performance budgets — the
 * Operations Platform verifies against the SAME signals the Performance Platform
 * measures, so there is no duplicated monitoring.
 */

/** How a measured value is compared to a threshold (shared by SLIs + alerts). */
export const OPS_COMPARATOR = {
  /** Measured must be ≤ threshold (latency, error rate, utilization, cost). */
  AtMost: 'at_most',
  /** Measured must be ≥ threshold (availability, success rate, hit ratio). */
  AtLeast: 'at_least',
} as const;
export type OpsComparator = (typeof OPS_COMPARATOR)[keyof typeof OPS_COMPARATOR];

// ─────────────────────────────────────────────────────────────────────────────
// Service Level Objectives
// ─────────────────────────────────────────────────────────────────────────────

/** The class of service-level indicator. */
export const SLI_KIND = {
  Availability: 'availability',
  Latency: 'latency',
  ErrorRate: 'error_rate',
  SuccessRate: 'success_rate',
} as const;
export type SliKind = (typeof SLI_KIND)[keyof typeof SLI_KIND];

/** A declarative service-level objective. Evaluated by the pure SLO rule. */
export interface SloDefinition {
  /** Stable id (kebab/colon) — the dedup + override key. */
  readonly id: string;
  /** Service the objective governs (drives the dashboard grouping). */
  readonly service: string;
  readonly label: string;
  readonly kind: SliKind;
  /**
   * The performance/analysis metric the SLI is read from (see slo.service).
   * Reuses the SAME metrics the Performance Platform already measures.
   */
  readonly metric: string;
  /** Objective target: availability/success as a ratio 0..1, latency in ms. */
  readonly objective: number;
  readonly unit: 'ratio' | 'ms' | 'percent';
  readonly comparator: OpsComparator;
}

/**
 * THE SLO catalogue. Each objective reads a signal the platform already
 * measures (P7.3 latency / error-rate, health availability) — no new
 * measurement path. Error budgets + burn rate are derived from these.
 */
export const SLO_DEFINITIONS: readonly SloDefinition[] = [
  {
    id: 'slo.api.availability',
    service: 'api',
    label: 'API availability',
    kind: SLI_KIND.Availability,
    metric: 'api.availability',
    objective: 0.999,
    unit: 'ratio',
    comparator: OPS_COMPARATOR.AtLeast,
  },
  {
    id: 'slo.api.latency',
    service: 'api',
    label: 'API latency p95',
    kind: SLI_KIND.Latency,
    metric: 'api.p95Ms',
    objective: 400,
    unit: 'ms',
    comparator: OPS_COMPARATOR.AtMost,
  },
  {
    id: 'slo.api.success_rate',
    service: 'api',
    label: 'API success rate',
    kind: SLI_KIND.SuccessRate,
    metric: 'api.successRate',
    objective: 0.99,
    unit: 'ratio',
    comparator: OPS_COMPARATOR.AtLeast,
  },
  {
    id: 'slo.ai.availability',
    service: 'ai',
    label: 'AI completion availability',
    kind: SLI_KIND.Availability,
    metric: 'ai.availability',
    objective: 0.99,
    unit: 'ratio',
    comparator: OPS_COMPARATOR.AtLeast,
  },
  {
    id: 'slo.ai.latency',
    service: 'ai',
    label: 'AI completion latency p95',
    kind: SLI_KIND.Latency,
    metric: 'ai.p95Ms',
    objective: 15_000,
    unit: 'ms',
    comparator: OPS_COMPARATOR.AtMost,
  },
  {
    id: 'slo.search.latency',
    service: 'search',
    label: 'Search latency p95',
    kind: SLI_KIND.Latency,
    metric: 'search.p95Ms',
    objective: 500,
    unit: 'ms',
    comparator: OPS_COMPARATOR.AtMost,
  },
  {
    id: 'slo.payments.success_rate',
    service: 'payments',
    label: 'Payment success rate',
    kind: SLI_KIND.SuccessRate,
    metric: 'payments.successRate',
    objective: 0.98,
    unit: 'ratio',
    comparator: OPS_COMPARATOR.AtLeast,
  },
] as const;

export const SLO_BY_ID: ReadonlyMap<string, SloDefinition> = new Map(
  SLO_DEFINITIONS.map((s) => [s.id, s]),
);

// ─────────────────────────────────────────────────────────────────────────────
// Alerting
// ─────────────────────────────────────────────────────────────────────────────

/** Alert severity (drives routing + escalation). */
export const ALERT_SEVERITY = {
  Critical: 'critical',
  Warning: 'warning',
  Info: 'info',
} as const;
export type AlertSeverity = (typeof ALERT_SEVERITY)[keyof typeof ALERT_SEVERITY];

/** Alert category — every category the prompt enumerates. */
export const ALERT_CATEGORY = {
  Performance: 'performance',
  Availability: 'availability',
  Infrastructure: 'infrastructure',
  Security: 'security',
  Capacity: 'capacity',
  Cost: 'cost',
  Queue: 'queue',
  AiProvider: 'ai_provider',
  Search: 'search',
  Payment: 'payment',
} as const;
export type AlertCategory = (typeof ALERT_CATEGORY)[keyof typeof ALERT_CATEGORY];

/** Where an alert of a given severity is routed (the routing table). */
export const ALERT_ROUTE = {
  [ALERT_SEVERITY.Critical]: 'oncall-primary',
  [ALERT_SEVERITY.Warning]: 'oncall-secondary',
  [ALERT_SEVERITY.Info]: 'ops-log',
} as const;

/** A declarative alert rule. Evaluated by the pure alert rule. */
export interface AlertRule {
  /** Stable id (kebab/colon) — the dedup key. */
  readonly id: string;
  readonly label: string;
  readonly category: AlertCategory;
  readonly severity: AlertSeverity;
  /** The metric the rule fires on (read from the same live analysis). */
  readonly metric: string;
  readonly comparator: OpsComparator;
  readonly threshold: number;
  readonly unit: 'ms' | 'percent' | 'ratio' | 'count' | 'seconds' | 'bytes' | 'usd';
  /** Runbook id an operator opens when this fires (links alerting → runbooks). */
  readonly runbookId: string;
}

/**
 * THE alert-rule catalogue. Every rule fires on a signal the platform ALREADY
 * has (P7.3 latency/error/cache/slow-query, capacity forecasts, queue backlog,
 * P7.2 security counters, cost estimate) — no parallel collection. Adding an
 * alert is adding a row.
 */
export const ALERT_RULES: readonly AlertRule[] = [
  {
    id: 'alert.api.error_rate.critical',
    label: 'API 5xx error rate critical',
    category: ALERT_CATEGORY.Availability,
    severity: ALERT_SEVERITY.Critical,
    metric: 'api.errorRatePercent',
    comparator: OPS_COMPARATOR.AtMost,
    threshold: 5,
    unit: 'percent',
    runbookId: 'runbook.api-error-spike',
  },
  {
    id: 'alert.api.error_rate.warning',
    label: 'API 5xx error rate elevated',
    category: ALERT_CATEGORY.Availability,
    severity: ALERT_SEVERITY.Warning,
    metric: 'api.errorRatePercent',
    comparator: OPS_COMPARATOR.AtMost,
    threshold: 1,
    unit: 'percent',
    runbookId: 'runbook.api-error-spike',
  },
  {
    id: 'alert.api.latency.warning',
    label: 'API latency p95 over budget',
    category: ALERT_CATEGORY.Performance,
    severity: ALERT_SEVERITY.Warning,
    metric: 'api.p95Ms',
    comparator: OPS_COMPARATOR.AtMost,
    threshold: 400,
    unit: 'ms',
    runbookId: 'runbook.latency-degradation',
  },
  {
    id: 'alert.runtime.event_loop.warning',
    label: 'Event-loop lag high',
    category: ALERT_CATEGORY.Performance,
    severity: ALERT_SEVERITY.Warning,
    metric: 'runtime.eventLoopLagP95Ms',
    comparator: OPS_COMPARATOR.AtMost,
    threshold: 70,
    unit: 'ms',
    runbookId: 'runbook.event-loop-lag',
  },
  {
    id: 'alert.runtime.memory.critical',
    label: 'Heap usage critical',
    category: ALERT_CATEGORY.Infrastructure,
    severity: ALERT_SEVERITY.Critical,
    metric: 'runtime.heapUsedBytes',
    comparator: OPS_COMPARATOR.AtMost,
    threshold: 1_073_741_824,
    unit: 'bytes',
    runbookId: 'runbook.memory-pressure',
  },
  {
    id: 'alert.capacity.scale.warning',
    label: 'A resource crossed its scale-out threshold',
    category: ALERT_CATEGORY.Capacity,
    severity: ALERT_SEVERITY.Warning,
    metric: 'capacity.shouldScaleCount',
    comparator: OPS_COMPARATOR.AtMost,
    threshold: 0,
    unit: 'count',
    runbookId: 'runbook.capacity-scale',
  },
  {
    id: 'alert.queue.backlog.warning',
    label: 'Queue backlog age high',
    category: ALERT_CATEGORY.Queue,
    severity: ALERT_SEVERITY.Warning,
    metric: 'queue.oldestWaitingSeconds',
    comparator: OPS_COMPARATOR.AtMost,
    threshold: 60,
    unit: 'seconds',
    runbookId: 'runbook.queue-backlog',
  },
  {
    id: 'alert.db.slow_query.warning',
    label: 'Slow queries detected',
    category: ALERT_CATEGORY.Performance,
    severity: ALERT_SEVERITY.Warning,
    metric: 'db.slowQueryCount',
    comparator: OPS_COMPARATOR.AtMost,
    threshold: 0,
    unit: 'count',
    runbookId: 'runbook.slow-queries',
  },
  {
    id: 'alert.cache.hit_ratio.warning',
    label: 'Cache hit ratio low',
    category: ALERT_CATEGORY.Performance,
    severity: ALERT_SEVERITY.Warning,
    metric: 'cache.hitRatio',
    comparator: OPS_COMPARATOR.AtLeast,
    threshold: 0.8,
    unit: 'ratio',
    runbookId: 'runbook.cache-degradation',
  },
  {
    id: 'alert.ai.latency.warning',
    label: 'AI completion latency high',
    category: ALERT_CATEGORY.AiProvider,
    severity: ALERT_SEVERITY.Warning,
    metric: 'ai.p95Ms',
    comparator: OPS_COMPARATOR.AtMost,
    threshold: 15_000,
    unit: 'ms',
    runbookId: 'runbook.ai-provider-degradation',
  },
  {
    id: 'alert.search.latency.warning',
    label: 'Search latency high',
    category: ALERT_CATEGORY.Search,
    severity: ALERT_SEVERITY.Warning,
    metric: 'search.p95Ms',
    comparator: OPS_COMPARATOR.AtMost,
    threshold: 500,
    unit: 'ms',
    runbookId: 'runbook.search-degradation',
  },
  {
    id: 'alert.payment.latency.warning',
    label: 'Payment operation latency high',
    category: ALERT_CATEGORY.Payment,
    severity: ALERT_SEVERITY.Warning,
    metric: 'payments.p95Ms',
    comparator: OPS_COMPARATOR.AtMost,
    threshold: 3_000,
    unit: 'ms',
    runbookId: 'runbook.payment-degradation',
  },
  {
    id: 'alert.security.events.warning',
    label: 'Security event surge',
    category: ALERT_CATEGORY.Security,
    severity: ALERT_SEVERITY.Warning,
    metric: 'security.eventRatePerMin',
    comparator: OPS_COMPARATOR.AtMost,
    threshold: 100,
    unit: 'count',
    runbookId: 'runbook.security-surge',
  },
  {
    id: 'alert.cost.daily.warning',
    label: 'Estimated daily cost over budget',
    category: ALERT_CATEGORY.Cost,
    severity: ALERT_SEVERITY.Warning,
    metric: 'cost.dailyUsd',
    comparator: OPS_COMPARATOR.AtMost,
    threshold: 50,
    unit: 'usd',
    runbookId: 'runbook.cost-spike',
  },
] as const;

export const ALERT_RULE_BY_ID: ReadonlyMap<string, AlertRule> = new Map(
  ALERT_RULES.map((r) => [r.id, r]),
);

// ─────────────────────────────────────────────────────────────────────────────
// Incident management
// ─────────────────────────────────────────────────────────────────────────────

/** Incident severity (SEV scale). */
export const INCIDENT_SEVERITY = {
  Sev1: 'sev1',
  Sev2: 'sev2',
  Sev3: 'sev3',
  Sev4: 'sev4',
} as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITY)[keyof typeof INCIDENT_SEVERITY];

/** Incident lifecycle states. */
export const INCIDENT_STATUS = {
  Open: 'open',
  Acknowledged: 'acknowledged',
  Investigating: 'investigating',
  Identified: 'identified',
  Monitoring: 'monitoring',
  Resolved: 'resolved',
} as const;
export type IncidentStatus = (typeof INCIDENT_STATUS)[keyof typeof INCIDENT_STATUS];

/** The states an incident may transition to from a given state (the lifecycle). */
export const INCIDENT_TRANSITIONS: Readonly<Record<IncidentStatus, readonly IncidentStatus[]>> = {
  [INCIDENT_STATUS.Open]: [INCIDENT_STATUS.Acknowledged, INCIDENT_STATUS.Investigating],
  [INCIDENT_STATUS.Acknowledged]: [INCIDENT_STATUS.Investigating, INCIDENT_STATUS.Resolved],
  [INCIDENT_STATUS.Investigating]: [INCIDENT_STATUS.Identified, INCIDENT_STATUS.Monitoring],
  [INCIDENT_STATUS.Identified]: [INCIDENT_STATUS.Monitoring, INCIDENT_STATUS.Resolved],
  [INCIDENT_STATUS.Monitoring]: [INCIDENT_STATUS.Resolved, INCIDENT_STATUS.Investigating],
  [INCIDENT_STATUS.Resolved]: [],
} as const;

/** Failure classification taxonomy (feeds reliability + postmortems). */
export const FAILURE_CLASS = {
  Dependency: 'dependency',
  Capacity: 'capacity',
  Deployment: 'deployment',
  Configuration: 'configuration',
  Code: 'code',
  External: 'external',
  Unknown: 'unknown',
} as const;
export type FailureClass = (typeof FAILURE_CLASS)[keyof typeof FAILURE_CLASS];

// ─────────────────────────────────────────────────────────────────────────────
// Cost observability
// ─────────────────────────────────────────────────────────────────────────────

/** Cost categories the platform estimates (a rate model, never a bill). */
export const COST_CATEGORY = {
  Ai: 'ai',
  Storage: 'storage',
  Bandwidth: 'bandwidth',
  Database: 'database',
  Redis: 'redis',
  Queue: 'queue',
  Api: 'api',
  ThirdParty: 'third_party',
  Infrastructure: 'infrastructure',
} as const;
export type CostCategory = (typeof COST_CATEGORY)[keyof typeof COST_CATEGORY];

// ─────────────────────────────────────────────────────────────────────────────
// Log classification
// ─────────────────────────────────────────────────────────────────────────────

/** Log classification classes (governs sampling + retention policy). */
export const LOG_CLASS = {
  /** Errors — never sampled, longest retention. */
  Error: 'error',
  /** Security/audit — never sampled (compliance). */
  Audit: 'audit',
  /** Request access logs — sampled by `LOG_SAMPLE_RATE`. */
  Access: 'access',
  /** Application/debug — sampled aggressively. */
  Application: 'application',
} as const;
export type LogClass = (typeof LOG_CLASS)[keyof typeof LOG_CLASS];

// ─────────────────────────────────────────────────────────────────────────────
// Metrics / redis / durable-store taxonomy
// ─────────────────────────────────────────────────────────────────────────────

/** Prometheus metric names exposed through the EXISTING `/metrics` registry. */
export const OPS_METRICS = {
  sloStatus: 'ops_slo_status',
  errorBudgetRemaining: 'ops_error_budget_remaining_ratio',
  alertsActive: 'ops_alerts_active',
  incidentsOpen: 'ops_incidents_open',
  deploymentsTotal: 'ops_deployments_total',
  costDailyUsd: 'ops_cost_daily_usd_estimate',
  tracesSampled: 'ops_traces_sampled_total',
  availabilityRatio: 'ops_availability_ratio',
} as const;

/**
 * Durable-store namespaces (P7.4). Operational RECORDS (incidents, deployments,
 * alert state) live in the AOF-backed durable Redis DB (`getClient('auth')`) —
 * the SAME migration-free durable-Redis pattern the Privacy module uses for
 * consent/DSR state — and every material change is ALSO written to the immutable
 * `audit_logs` trail (the permanent record). Ephemeral SNAPSHOTS (the report)
 * live in the cache DB via `CacheService`. No new tables, no migration.
 */
export const OPS_REDIS = {
  incidentPrefix: 'ops:incident:',
  incidentIndex: 'ops:incidents:index',
  alertStatePrefix: 'ops:alert:',
  alertIndex: 'ops:alerts:index',
  deploymentList: 'ops:deployments',
  maintenanceWindows: 'ops:maintenance-windows',
  reportSnapshot: 'ops:report:latest',
} as const;

/** How long the persisted ops report snapshot lives in the cache DB (seconds). */
export const OPS_SNAPSHOT_TTL_SECONDS = 7 * 24 * 3600;

/** Bounded in-memory SLI reservoir per objective (rolling outcome window). */
export const SLI_RESERVOIR_SIZE = 1000;
