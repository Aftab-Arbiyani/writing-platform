/**
 * Performance Platform vocabulary (P7.3) — the SINGLE SOURCE OF TRUTH for
 * performance budgets, capacity models, benchmark scenarios, and the metric
 * taxonomy. Centralizing them here is the whole point of the platform: business
 * services carry no thresholds or optimization logic; they emit samples and the
 * platform verifies them against these declarations. Adding a budget is adding a
 * row — never touching an engine.
 *
 * Nothing here is a secret. Numeric targets are informed by docs 05 (API
 * standards), docs 14 (monitoring), and the scaling path in docs 02 §8.
 */

/** How a measured value is compared to its budget target. */
export const BUDGET_COMPARATOR = {
  /** Measured must be ≤ target (latency, size, utilization). */
  AtMost: 'at_most',
  /** Measured must be ≥ target (hit ratio, throughput headroom). */
  AtLeast: 'at_least',
} as const;
export type BudgetComparator = (typeof BUDGET_COMPARATOR)[keyof typeof BUDGET_COMPARATOR];

/** The subsystem/domain a budget governs (buckets the summary + report). */
export const BUDGET_DOMAIN = {
  Api: 'api',
  Database: 'database',
  Redis: 'redis',
  Queue: 'queue',
  Search: 'search',
  Ai: 'ai',
  Storage: 'storage',
  Frontend: 'frontend',
  Flutter: 'flutter',
  Runtime: 'runtime',
} as const;
export type BudgetDomain = (typeof BUDGET_DOMAIN)[keyof typeof BUDGET_DOMAIN];

/** A declarative performance budget. Verified by the pure rule pipeline. */
export interface PerformanceBudget {
  /** Stable id (kebab/colon), used as the dedup + override key. */
  readonly id: string;
  readonly domain: BudgetDomain;
  /** Human label for reports. */
  readonly label: string;
  /** The metric the measured value is read from (see PerformanceAnalysis). */
  readonly metric: string;
  readonly target: number;
  readonly unit: 'ms' | 'ratio' | 'percent' | 'bytes' | 'kb' | 'count' | 'rps';
  readonly comparator: BudgetComparator;
  /**
   * When true, the budget is verified only when a live measurement exists
   * (client-side budgets — frontend/flutter/page-load — are declared but
   * measured out-of-band by their own harnesses, so they are informational here).
   */
  readonly serverMeasured: boolean;
}

/**
 * THE budget catalogue. Every budget the prompt enumerates lives here — API
 * latency, DB queries, search, AI first-token/completion, queue processing,
 * page load, startup, bundle size, memory, CPU, storage throughput, background
 * jobs. Server-measured budgets are verified live against the analysis; client
 * budgets (frontend/flutter) are declared here as the canonical targets their
 * own harnesses check (docs 43).
 */
export const PERFORMANCE_BUDGETS: readonly PerformanceBudget[] = [
  // ── API ────────────────────────────────────────────────────────────────
  {
    id: 'api.latency.p95',
    domain: BUDGET_DOMAIN.Api,
    label: 'API latency p95',
    metric: 'http.p95Ms',
    target: 400,
    unit: 'ms',
    comparator: BUDGET_COMPARATOR.AtMost,
    serverMeasured: true,
  },
  {
    id: 'api.latency.p99',
    domain: BUDGET_DOMAIN.Api,
    label: 'API latency p99',
    metric: 'http.p99Ms',
    target: 1000,
    unit: 'ms',
    comparator: BUDGET_COMPARATOR.AtMost,
    serverMeasured: true,
  },
  {
    id: 'api.error_rate',
    domain: BUDGET_DOMAIN.Api,
    label: 'API 5xx error rate',
    metric: 'http.errorRate',
    target: 1,
    unit: 'percent',
    comparator: BUDGET_COMPARATOR.AtMost,
    serverMeasured: true,
  },
  // ── Database ──────────────────────────────────────────────────────────────
  {
    id: 'db.query.slow_count',
    domain: BUDGET_DOMAIN.Database,
    label: 'Slow queries (window)',
    metric: 'db.slowQueryCount',
    target: 0,
    unit: 'count',
    comparator: BUDGET_COMPARATOR.AtMost,
    serverMeasured: true,
  },
  {
    id: 'db.pool.utilization',
    domain: BUDGET_DOMAIN.Database,
    label: 'Connection pool utilization',
    metric: 'db.poolUtilizationPct',
    target: 80,
    unit: 'percent',
    comparator: BUDGET_COMPARATOR.AtMost,
    serverMeasured: false,
  },
  // ── Redis / cache ───────────────────────────────────────────────────────
  {
    id: 'redis.hit_ratio',
    domain: BUDGET_DOMAIN.Redis,
    label: 'Cache hit ratio',
    metric: 'cache.hitRatio',
    target: 0.8,
    unit: 'ratio',
    comparator: BUDGET_COMPARATOR.AtLeast,
    serverMeasured: true,
  },
  {
    id: 'redis.op.p95',
    domain: BUDGET_DOMAIN.Redis,
    label: 'Cache op latency p95',
    metric: 'cache.p95Ms',
    target: 10,
    unit: 'ms',
    comparator: BUDGET_COMPARATOR.AtMost,
    serverMeasured: true,
  },
  // ── Queue ─────────────────────────────────────────────────────────────────
  {
    id: 'queue.processing.p95',
    domain: BUDGET_DOMAIN.Queue,
    label: 'Job processing p95',
    metric: 'queue.p95Ms',
    target: 5000,
    unit: 'ms',
    comparator: BUDGET_COMPARATOR.AtMost,
    serverMeasured: true,
  },
  {
    id: 'queue.backlog.oldest',
    domain: BUDGET_DOMAIN.Queue,
    label: 'Oldest waiting job age',
    metric: 'queue.oldestWaitingMs',
    target: 60_000,
    unit: 'ms',
    comparator: BUDGET_COMPARATOR.AtMost,
    serverMeasured: false,
  },
  // ── Search ──────────────────────────────────────────────────────────────
  {
    id: 'search.query.p95',
    domain: BUDGET_DOMAIN.Search,
    label: 'Search query p95',
    metric: 'search.p95Ms',
    target: 500,
    unit: 'ms',
    comparator: BUDGET_COMPARATOR.AtMost,
    serverMeasured: true,
  },
  // ── AI ────────────────────────────────────────────────────────────────────
  {
    id: 'ai.first_token',
    domain: BUDGET_DOMAIN.Ai,
    label: 'AI first-token latency',
    metric: 'ai.firstTokenP95Ms',
    target: 2500,
    unit: 'ms',
    comparator: BUDGET_COMPARATOR.AtMost,
    serverMeasured: false,
  },
  {
    id: 'ai.completion.p95',
    domain: BUDGET_DOMAIN.Ai,
    label: 'AI completion latency p95',
    metric: 'ai.p95Ms',
    target: 15_000,
    unit: 'ms',
    comparator: BUDGET_COMPARATOR.AtMost,
    serverMeasured: true,
  },
  // ── Storage ──────────────────────────────────────────────────────────────
  {
    id: 'storage.signing.p95',
    domain: BUDGET_DOMAIN.Storage,
    label: 'Signed-URL issuance p95',
    metric: 'storage.p95Ms',
    target: 300,
    unit: 'ms',
    comparator: BUDGET_COMPARATOR.AtMost,
    serverMeasured: true,
  },
  // ── Runtime (process) ─────────────────────────────────────────────────────
  {
    id: 'runtime.event_loop_lag.p95',
    domain: BUDGET_DOMAIN.Runtime,
    label: 'Event-loop lag p95',
    metric: 'resource.eventLoopLagP95Ms',
    target: 70,
    unit: 'ms',
    comparator: BUDGET_COMPARATOR.AtMost,
    serverMeasured: true,
  },
  {
    id: 'runtime.memory.heap_used',
    domain: BUDGET_DOMAIN.Runtime,
    label: 'Heap used',
    metric: 'resource.heapUsedBytes',
    target: 1_073_741_824,
    unit: 'bytes',
    comparator: BUDGET_COMPARATOR.AtMost,
    serverMeasured: true,
  },
  {
    id: 'runtime.cpu.utilization',
    domain: BUDGET_DOMAIN.Runtime,
    label: 'CPU utilization',
    metric: 'resource.cpuPercent',
    target: 85,
    unit: 'percent',
    comparator: BUDGET_COMPARATOR.AtMost,
    serverMeasured: true,
  },
  {
    id: 'runtime.startup',
    domain: BUDGET_DOMAIN.Runtime,
    label: 'Application startup',
    metric: 'resource.startupMs',
    target: 8000,
    unit: 'ms',
    comparator: BUDGET_COMPARATOR.AtMost,
    serverMeasured: true,
  },
  // ── Client budgets (declared here; verified by their own harnesses) ───────
  {
    id: 'frontend.bundle.initial',
    domain: BUDGET_DOMAIN.Frontend,
    label: 'Frontend initial JS (gzip)',
    metric: 'frontend.initialJsKb',
    target: 300,
    unit: 'kb',
    comparator: BUDGET_COMPARATOR.AtMost,
    serverMeasured: false,
  },
  {
    id: 'frontend.page_load.lcp',
    domain: BUDGET_DOMAIN.Frontend,
    label: 'Page load LCP',
    metric: 'frontend.lcpMs',
    target: 2500,
    unit: 'ms',
    comparator: BUDGET_COMPARATOR.AtMost,
    serverMeasured: false,
  },
  {
    id: 'flutter.startup.cold',
    domain: BUDGET_DOMAIN.Flutter,
    label: 'Flutter cold start',
    metric: 'flutter.coldStartMs',
    target: 2500,
    unit: 'ms',
    comparator: BUDGET_COMPARATOR.AtMost,
    serverMeasured: false,
  },
  {
    id: 'flutter.frame.build_p95',
    domain: BUDGET_DOMAIN.Flutter,
    label: 'Flutter frame build p95',
    metric: 'flutter.frameBuildP95Ms',
    target: 16,
    unit: 'ms',
    comparator: BUDGET_COMPARATOR.AtMost,
    serverMeasured: false,
  },
] as const;

/** Fast lookup of a budget by id. */
export const BUDGET_BY_ID: ReadonlyMap<string, PerformanceBudget> = new Map(
  PERFORMANCE_BUDGETS.map((b) => [b.id, b]),
);

/**
 * Capacity models (P7.3 capacity planning) — the resource ceilings the platform
 * forecasts against. `limit` is the hard ceiling for a single instance;
 * `scaleAtPct` is the utilization at which to scale out (docs 02 §8). All are
 * env/deployment tunable via {@link performanceConfig}; the values here are the
 * documented single-VM defaults.
 */
export interface CapacityModel {
  readonly resource: string;
  readonly label: string;
  /** How the ceiling is expressed. */
  readonly unit: 'connections' | 'workers' | 'rps' | 'bytes' | 'jobs' | 'tokens';
  readonly limit: number;
  /** Utilization (%) that triggers a scale-out recommendation. */
  readonly scaleAtPct: number;
  /** The horizontal-scaling lever (docs 02 §8), for the recommendation. */
  readonly scaleLever: string;
}

export const CAPACITY_MODELS: readonly CapacityModel[] = [
  {
    resource: 'db.connections',
    label: 'Database connections',
    unit: 'connections',
    limit: 10,
    scaleAtPct: 80,
    scaleLever: 'raise DB_POOL_MAX / add read replica (DATABASE_REPLICA_URL)',
  },
  {
    resource: 'workers',
    label: 'Queue workers (aggregate concurrency)',
    unit: 'workers',
    limit: 24,
    scaleAtPct: 80,
    scaleLever: 'raise QUEUE_<NAME>_CONCURRENCY / extract worker deployment (docs 02 §8 stage 3)',
  },
  {
    resource: 'api.rps',
    label: 'API requests/sec (single instance)',
    unit: 'rps',
    limit: 500,
    scaleAtPct: 70,
    scaleLever: 'horizontal scale API instances behind nginx (stateless)',
  },
  {
    resource: 'redis.memory',
    label: 'Redis memory',
    unit: 'bytes',
    limit: 536_870_912,
    scaleAtPct: 75,
    scaleLever: 'raise maxmemory / split logical DBs to instances / Redis cluster',
  },
  {
    resource: 'storage.objects',
    label: 'Object storage (S3/MinIO)',
    unit: 'bytes',
    limit: 107_374_182_400,
    scaleAtPct: 80,
    scaleLever: 'S3/R2 scales elastically; provision bucket lifecycle + CDN',
  },
  {
    resource: 'ai.tokens_daily',
    label: 'AI tokens / day',
    unit: 'tokens',
    limit: 10_000_000,
    scaleAtPct: 80,
    scaleLever: 'add AI provider capacity / raise org token caps / add adapter',
  },
] as const;

/**
 * Repeatable, deterministic benchmark scenarios. Each exercises a reusable pure
 * hot-path function a fixed number of iterations (no I/O, no clock-dependence in
 * the code path itself), so results are comparable run-to-run and gate
 * regressions. Live-infra benchmarks (DB/Redis/queue round-trips) are separate
 * and best-effort (skipped when infra is unreachable, like the queue metrics).
 */
export const BENCHMARK_SCENARIO = {
  CursorEncode: 'cursor-encode-decode',
  ResponseEnvelope: 'response-envelope-serialize',
  PermissionResolve: 'permission-resolve',
  TokenEstimate: 'ai-token-estimate',
  PromptRender: 'ai-prompt-render',
  LatencyPercentile: 'latency-percentile-compute',
} as const;
export type BenchmarkScenarioId = (typeof BENCHMARK_SCENARIO)[keyof typeof BENCHMARK_SCENARIO];

/** Named benchmark suites the prompt enumerates (grouped for the report). */
export const BENCHMARK_SUITES = [
  'authentication',
  'story-reading',
  'story-publishing',
  'search',
  'recommendations',
  'ai-writing',
  'ai-story-intelligence',
  'subscriptions',
  'payments',
  'comments',
  'collaboration',
  'moderation',
] as const;

/** Prometheus metric names exposed through the EXISTING `/metrics` registry. */
export const PERF_METRICS = {
  operationLatency: 'perf_operation_duration_seconds',
  operationTotal: 'perf_operations_total',
  cacheHitRatio: 'perf_cache_hit_ratio',
  slowQueries: 'perf_slow_queries_total',
  eventLoopLag: 'perf_event_loop_lag_seconds',
  heapUsed: 'perf_heap_used_bytes',
  cpuPercent: 'perf_cpu_percent',
  budgetStatus: 'perf_budget_status',
  capacityUtilization: 'perf_capacity_utilization_ratio',
} as const;

/** Redis namespaces the platform owns (ephemeral ops telemetry, DB 0). */
export const PERF_REDIS = {
  /** Latest persisted performance report snapshot. */
  reportSnapshot: 'perf:report:latest',
  /** Latest benchmark run results. */
  benchmarkResults: 'perf:benchmark:latest',
} as const;

/** How long persisted perf telemetry lives in Redis (seconds). */
export const PERF_SNAPSHOT_TTL_SECONDS = 7 * 24 * 3600;

/** Bounded reservoir size per operation (rolling latency window). */
export const LATENCY_RESERVOIR_SIZE = 500;

/** How many slow queries to retain for the report (ring buffer). */
export const SLOW_QUERY_BUFFER_SIZE = 50;
