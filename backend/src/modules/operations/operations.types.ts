/**
 * Operations Platform domain types (P7.4). Pure data shapes shared across the
 * observability, SLO, alerting, incident, deployment, cost, reliability, health,
 * rollout, runbook, and governance services. No Nest/TypeORM dependency —
 * trivially unit-testable.
 */
import type {
  AlertCategory,
  AlertSeverity,
  CostCategory,
  FailureClass,
  IncidentSeverity,
  IncidentStatus,
  OpsComparator,
  SliKind,
} from './operations.constants';
import type { SpanKind, SpanStatus } from '../../common/operations/tracing.port';

// ── Operational signals (the resolved snapshot) ─────────────────────────────

/**
 * A flat, resolved snapshot of every operational signal the SLO + alert rules
 * read — assembled ONCE by the SignalCollector from the platforms already
 * measuring them (P7.3 performance analysis + capacity, the queue monitor, the
 * cost estimate, the ops registry counters). This is the "reuse, no duplicate
 * monitoring" boundary: rules read this snapshot; nothing re-measures. `null`
 * means no live signal yet (→ SLO `no_data` / alert not firing — never a false
 * positive), mirroring the P7.3 `not_measured` verdict.
 */
export interface OperationalSignals {
  readonly api: {
    readonly p95Ms: number | null;
    readonly p99Ms: number | null;
    readonly errorRatePercent: number | null;
    readonly availability: number | null;
    readonly successRate: number | null;
  };
  readonly ai: { readonly p95Ms: number | null; readonly availability: number | null };
  readonly search: { readonly p95Ms: number | null };
  readonly payments: { readonly p95Ms: number | null; readonly successRate: number | null };
  readonly cache: { readonly hitRatio: number | null };
  readonly db: { readonly slowQueryCount: number };
  readonly runtime: {
    readonly eventLoopLagP95Ms: number;
    readonly heapUsedBytes: number;
    readonly cpuPercent: number;
  };
  readonly queue: { readonly oldestWaitingSeconds: number | null };
  readonly capacity: { readonly shouldScaleCount: number };
  readonly security: { readonly eventRatePerMin: number | null };
  readonly cost: { readonly dailyUsd: number };
}

// ── Observability ──────────────────────────────────────────────────────────

/** The posture of the observability trio (metrics + logs + traces). */
export interface ObservabilityPosture {
  readonly generatedAt: string;
  readonly metrics: {
    readonly exposed: boolean;
    readonly endpoint: string;
    readonly series: number;
  };
  readonly logging: {
    readonly structured: boolean;
    readonly format: 'json';
    readonly sampleRate: number;
    readonly retentionDays: number;
    readonly redactionEnforced: boolean;
    readonly classes: readonly string[];
  };
  readonly tracing: {
    readonly enabled: boolean;
    readonly sampleRate: number;
    readonly tracesRetained: number;
    readonly spansRetained: number;
  };
}

// ── Distributed tracing (read model) ─────────────────────────────────────────

/** One recorded span (read model for the admin trace viewer). */
export interface RecordedSpan {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId: string | null;
  readonly name: string;
  readonly kind: SpanKind;
  readonly durationMs: number;
  readonly status: SpanStatus;
  readonly startedAt: string;
  readonly attributes: Readonly<Record<string, string | number | boolean>>;
}

/** A reconstructed trace (one root + its spans). */
export interface RecordedTrace {
  readonly traceId: string;
  readonly rootName: string;
  readonly spanCount: number;
  readonly durationMs: number;
  readonly status: SpanStatus;
  readonly startedAt: string;
  readonly spans: readonly RecordedSpan[];
}

// ── SLO / error budget ───────────────────────────────────────────────────────

/** One SLO's live position (SLI vs objective + error budget + burn rate). */
export interface SloStatus {
  readonly id: string;
  readonly service: string;
  readonly label: string;
  readonly kind: SliKind;
  readonly objective: number;
  readonly unit: string;
  readonly comparator: OpsComparator;
  /** The measured SLI, or null when there is no signal yet. */
  readonly sli: number | null;
  /** Fraction of the error budget still available (0..1), null when N/A. */
  readonly errorBudgetRemaining: number | null;
  /** Current burn-rate multiple of the sustainable rate (null when N/A). */
  readonly burnRate: number | null;
  readonly status: 'meeting' | 'at_risk' | 'breaching' | 'no_data';
}

/** The SLO surface. */
export interface SloReport {
  readonly generatedAt: string;
  readonly windowSeconds: number;
  readonly objectives: readonly SloStatus[];
  readonly meeting: number;
  readonly atRisk: number;
  readonly breaching: number;
}

// ── Alerting ───────────────────────────────────────────────────────────────

/** A live alert evaluation result. */
export interface AlertEvaluation {
  readonly id: string;
  readonly label: string;
  readonly category: AlertCategory;
  readonly severity: AlertSeverity;
  readonly metric: string;
  readonly threshold: number;
  readonly unit: string;
  readonly measured: number | null;
  readonly firing: boolean;
  readonly runbookId: string;
  /** Where the alert routes when firing (from the routing table). */
  readonly route: string;
  /** True when suppressed by dedup or an active maintenance window. */
  readonly suppressed: boolean;
  readonly suppressedReason: string | null;
}

/** The alerting surface. */
export interface AlertReport {
  readonly generatedAt: string;
  readonly firing: number;
  readonly suppressed: number;
  readonly evaluations: readonly AlertEvaluation[];
}

/** A maintenance window (suppresses alerts in a category for a period). */
export interface MaintenanceWindow {
  readonly id: string;
  readonly reason: string;
  /** Categories suppressed; empty means all. */
  readonly categories: readonly AlertCategory[];
  readonly startsAt: string;
  readonly endsAt: string;
}

// ── Incident management ──────────────────────────────────────────────────────

/** One immutable entry on an incident's timeline. */
export interface IncidentTimelineEntry {
  readonly at: string;
  /** e.g. `opened`, `status:investigating`, `assigned`, `note`, `resolved`. */
  readonly type: string;
  readonly message: string;
  /** The actor's user id, or `system` for automated entries. */
  readonly actorId: string;
}

/** An incident aggregate (durable Redis record; mirrored to the audit trail). */
export interface Incident {
  readonly id: string;
  readonly title: string;
  readonly severity: IncidentSeverity;
  readonly status: IncidentStatus;
  readonly service: string | null;
  readonly assigneeId: string | null;
  readonly failureClass: FailureClass | null;
  readonly rootCause: string | null;
  /** The alert rule id that opened it, when auto-created. */
  readonly sourceAlertId: string | null;
  readonly createdAt: string;
  readonly acknowledgedAt: string | null;
  readonly resolvedAt: string | null;
  /** Minutes from open → resolve (feeds MTTR); null while open. */
  readonly timeToResolveMinutes: number | null;
  readonly recoveryVerified: boolean;
  readonly timeline: readonly IncidentTimelineEntry[];
}

/** A postmortem template pre-filled from a resolved incident. */
export interface PostmortemTemplate {
  readonly incidentId: string;
  readonly title: string;
  readonly severity: IncidentSeverity;
  readonly summary: string;
  readonly impact: string;
  readonly timeline: readonly IncidentTimelineEntry[];
  readonly rootCause: string;
  readonly failureClass: FailureClass | null;
  readonly actionItems: readonly string[];
  readonly timeToResolveMinutes: number | null;
}

// ── Deployment observability ─────────────────────────────────────────────────

/** The type of a change record. */
export type ChangeType = 'deployment' | 'rollback' | 'migration' | 'config' | 'infrastructure';

/** A deployment / change record (durable list + audit trail). */
export interface DeploymentRecord {
  readonly id: string;
  readonly type: ChangeType;
  readonly version: string;
  readonly gitSha: string;
  readonly environment: string;
  readonly status: 'succeeded' | 'failed' | 'in_progress';
  readonly durationSeconds: number | null;
  readonly at: string;
  readonly actorId: string | null;
  readonly note: string | null;
}

/** The deployment-observability surface. */
export interface DeploymentReport {
  readonly generatedAt: string;
  readonly current: {
    readonly version: string;
    readonly gitSha: string;
    readonly environment: string;
    readonly releaseChannel: string;
    readonly instanceId: string;
    readonly startedAt: string;
    readonly uptimeSeconds: number;
  };
  readonly totalDeployments: number;
  readonly successRate: number;
  readonly rollbacks: number;
  readonly averageDurationSeconds: number | null;
  readonly recent: readonly DeploymentRecord[];
}

// ── Cost observability ───────────────────────────────────────────────────────

/** One category's estimated cost. */
export interface CostLine {
  readonly category: CostCategory;
  readonly label: string;
  readonly dailyUsd: number;
  readonly monthlyUsd: number;
  /** What the estimate is derived from (transparency, never a bill). */
  readonly basis: string;
}

/** The cost-observability surface (an internal estimate, not billing). */
export interface CostReport {
  readonly generatedAt: string;
  readonly currency: 'USD';
  readonly dailyUsd: number;
  readonly monthlyUsd: number;
  readonly lines: readonly CostLine[];
  readonly trend: 'rising' | 'stable' | 'falling' | 'unknown';
}

// ── Reliability engineering ──────────────────────────────────────────────────

/** The reliability surface (availability, MTTR, MTBF, failure classes). */
export interface ReliabilityReport {
  readonly generatedAt: string;
  readonly windowDays: number;
  readonly availabilityRatio: number;
  readonly incidentsTotal: number;
  readonly incidentsResolved: number;
  readonly mttrMinutes: number | null;
  readonly mtbfHours: number | null;
  readonly failuresByClass: Readonly<Record<string, number>>;
  readonly recoveryVerifiedRate: number;
}

// ── Operational health ───────────────────────────────────────────────────────

/** Health of one monitored component. */
export interface ComponentHealth {
  readonly name: string;
  readonly category: 'service' | 'dependency' | 'infrastructure' | 'worker' | 'third_party';
  readonly status: 'healthy' | 'degraded' | 'down' | 'unknown';
  readonly detail: string;
}

/** The operational-health surface (overall + per-component + readiness). */
export interface OperationalHealthReport {
  readonly generatedAt: string;
  readonly overall: 'healthy' | 'degraded' | 'unhealthy';
  readonly ready: boolean;
  readonly components: readonly ComponentHealth[];
  readonly statusSummary: string;
}

// ── Feature rollout ──────────────────────────────────────────────────────────

/** A feature rollout's live state (a projection over feature flags). */
export interface RolloutState {
  readonly key: string;
  readonly enabled: boolean;
  readonly rolloutPercentage: number;
  readonly environment: string;
  readonly strategy: 'off' | 'full' | 'percentage' | 'canary' | 'environment';
  readonly killSwitchEngaged: boolean;
  readonly description: string;
}

// ── Runbooks ─────────────────────────────────────────────────────────────────

/** A declarative runbook (operational playbook). */
export interface Runbook {
  readonly id: string;
  readonly title: string;
  readonly symptom: string;
  readonly severity: AlertSeverity;
  readonly steps: readonly string[];
  /** Alert rule ids this runbook resolves. */
  readonly linkedAlerts: readonly string[];
}

// ── Chaos engineering (readiness only — no execution) ────────────────────────

/** A chaos scenario the architecture is prepared for (documented resilience). */
export interface ChaosScenario {
  readonly id: string;
  readonly label: string;
  /** The failure injected. */
  readonly failure: string;
  /** The existing platform mechanism that absorbs it (no new code). */
  readonly mitigation: string;
  /** Whether the mitigation is a live safeguard or a documented lever. */
  readonly readiness: 'built-in' | 'documented';
}
