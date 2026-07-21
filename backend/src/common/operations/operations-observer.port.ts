/**
 * The single, dependency-free operations-telemetry seam (P7.4). Lives in
 * `common/` so any layer — a Nest provider, a scheduler job, or DI-less
 * infrastructure — can emit an operational signal to the Operations Platform
 * WITHOUT importing it (one-way arrow, no cycle), mirroring the P7.3
 * `PERFORMANCE_OBSERVER` / `AI_USAGE_METER` optional-hook pattern.
 *
 * The Operations Platform's registry implements {@link OperationsObserver} and
 * registers itself (both as the `OPERATIONS_OBSERVER` DI token AND via
 * {@link registerOperationsObserver} for DI-less callers) on module init. Every
 * emission point calls `getOperationsObserver()?.record(...)` — a no-op until the
 * platform is wired, so instrumentation never breaks a request when the platform
 * is absent (unit tests, minimal boots).
 *
 * This is the ONE place operational signals converge: SLI outcomes, alert
 * signals, deployment/config/rollout change events, and reliability failures.
 * Business services carry NO alerting/SLO/incident logic — they emit a signal and
 * the platform owns evaluation, deduplication, routing, and reporting centrally.
 * The Operations Platform composes (never duplicates) the Performance Platform's
 * latency/throughput/error signals via the existing `PERFORMANCE_OBSERVER`; this
 * seam carries only the operational events performance does not already model.
 */

/** The class of operational signal (drives which read model it feeds). */
export type OpsSignalKind =
  /** A service-level indicator outcome (feeds SLIs / error budgets). */
  | 'sli'
  /** A raw alert signal (a metric breach a rule may fire on). */
  | 'alert'
  /** A deployment / release lifecycle event. */
  | 'deployment'
  /** A configuration / infrastructure change event. */
  | 'config-change'
  /** A feature-rollout change (percentage / kill-switch / emergency disable). */
  | 'rollout'
  /** A classified failure (feeds reliability + failure classification). */
  | 'failure';

/** A single operational signal. `name` is a stable, low-cardinality label. */
export interface OpsSignal {
  readonly kind: OpsSignalKind;
  /** Stable, low-cardinality label, e.g. `slo.api.availability`, `deploy.recorded`. */
  readonly name: string;
  /** True for a healthy/successful outcome; false for a breach/error/failure. */
  readonly ok: boolean;
  /** Optional numeric measurement (latency ms, cost usd, count) for the signal. */
  readonly value?: number;
  /** Optional low-cardinality attributes (never PII / secrets / raw ids). */
  readonly attributes?: Readonly<Record<string, string | number | boolean>>;
}

/**
 * Sink for operational telemetry. Implemented once by the Operations Platform
 * registry; every method is fire-and-forget and MUST NOT throw (implementations
 * swallow their own errors) so a measurement can never fail the measured path.
 */
export interface OperationsObserver {
  /** Record one operational signal. */
  record(signal: OpsSignal): void;
  /**
   * Prometheus text lines for the SHARED `/metrics` registry (optional). Lets the
   * platform expose its signals through the existing scrape target instead of
   * standing up parallel monitoring infrastructure.
   */
  metricLines?(): string[];
}

let activeObserver: OperationsObserver | undefined;

/**
 * Wire the live observer (called once by `OperationsModule.onModuleInit`). Lets
 * DI-less code reach the same singleton the DI token resolves to.
 */
export function registerOperationsObserver(observer: OperationsObserver): void {
  activeObserver = observer;
}

/** The live observer, or `undefined` until the platform registers one. */
export function getOperationsObserver(): OperationsObserver | undefined {
  return activeObserver;
}

/** DI token for the same observer, for Nest providers that prefer injection. */
export const OPERATIONS_OBSERVER = Symbol('OPERATIONS_OBSERVER');
