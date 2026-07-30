/**
 * The single, dependency-free performance-measurement seam (P7.3). Lives in
 * `common/` so any layer — a Nest provider, or DI-less infrastructure like the
 * TypeORM query logger — can feed a timing sample to the Performance Platform
 * WITHOUT importing it (one-way arrow, no cycle), mirroring the
 * `AI_USAGE_METER` / `JOB_ENQUEUER` optional-hook pattern.
 *
 * The Performance Platform's registry implements {@link PerformanceObserver} and
 * registers itself (both as the `PERFORMANCE_OBSERVER` DI token AND via
 * {@link registerPerformanceObserver} for DI-less callers) on module init. Every
 * measurement point calls `getPerformanceObserver()?.observe(...)` — a no-op
 * until the platform is wired, so instrumentation never breaks a request when
 * the platform is absent (unit tests, minimal boots). This is why business
 * services carry **no** optimization logic: they emit a sample; the platform
 * owns analysis, budgets, and reporting centrally.
 */

/** The subsystem a timing sample belongs to (drives per-kind aggregation). */
export type PerfOperationKind = 'http' | 'db' | 'cache' | 'queue' | 'search' | 'ai' | 'storage';

/** One completed operation's timing. `operation` is a low-cardinality label. */
export interface PerformanceSample {
  /** Stable, low-cardinality operation label, e.g. `GET /pieces/:id`, `queue.notifications.broadcast`. */
  readonly operation: string;
  readonly kind: PerfOperationKind;
  readonly durationMs: number;
  /** False for 5xx / failed jobs / errored operations (feeds the error-rate signal). */
  readonly ok: boolean;
}

/** A query that exceeded the slow-query threshold (slow-query detection). */
export interface SlowQuerySample {
  /** Truncated, parameter-free SQL text (never contains bound values). */
  readonly sql: string;
  readonly durationMs: number;
}

/**
 * Sink for performance telemetry. Implemented once by the Performance Platform
 * registry; every method is fire-and-forget and MUST NOT throw (implementations
 * swallow their own errors) so a measurement can never fail the measured path.
 */
export interface PerformanceObserver {
  /** Record one completed operation's latency + outcome. */
  observe(sample: PerformanceSample): void;
  /** Record a cache lookup outcome (feeds the cache hit-ratio signal). */
  recordCache(hit: boolean): void;
  /** Record a query that breached the slow-query threshold. */
  recordSlowQuery(sample: SlowQuerySample): void;
  /**
   * Prometheus text lines for the SHARED `/metrics` registry (optional). Lets
   * the platform expose its signals through the existing scrape target instead
   * of standing up parallel monitoring infrastructure.
   */
  metricLines?(): string[];
}

let activeObserver: PerformanceObserver | undefined;

/**
 * Wire the live observer (called once by `PerformanceModule.onModuleInit`).
 * Lets DI-less code (the TypeORM logger built inside the datasource factory)
 * reach the same singleton the DI token resolves to.
 */
export function registerPerformanceObserver(observer: PerformanceObserver): void {
  activeObserver = observer;
}

/** The live observer, or `undefined` until the platform registers one. */
export function getPerformanceObserver(): PerformanceObserver | undefined {
  return activeObserver;
}

/** DI token for the same observer, for Nest providers that prefer injection. */
export const PERFORMANCE_OBSERVER = Symbol('PERFORMANCE_OBSERVER');
