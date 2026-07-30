/**
 * Performance Platform domain types (P7.3). Pure data shapes shared across the
 * analysis, budget, capacity, benchmark, verification, and report services. No
 * Nest/TypeORM dependency — trivially unit-testable.
 */
import type { BudgetComparator, BudgetDomain } from './performance.constants';
import type { PerfOperationKind } from '../../common/performance/performance-observer.port';

/** Latency percentiles + volume for one operation or kind. */
export interface LatencyStats {
  readonly count: number;
  readonly errorCount: number;
  readonly minMs: number;
  readonly meanMs: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
  readonly maxMs: number;
}

/** Latency + throughput for a single named operation. */
export interface OperationStats extends LatencyStats {
  readonly operation: string;
  readonly kind: PerfOperationKind;
}

/** The latency analysis surface. */
export interface LatencyAnalysis {
  /** Aggregate across all operations. */
  readonly overall: LatencyStats;
  /** Per operation-kind rollup. */
  readonly byKind: Partial<Record<PerfOperationKind, LatencyStats>>;
  /** Slowest operations by p95 (bounded). */
  readonly slowest: readonly OperationStats[];
}

/** The throughput analysis surface. */
export interface ThroughputAnalysis {
  readonly windowSeconds: number;
  readonly totalOperations: number;
  readonly operationsPerSecond: number;
  readonly errorRatePercent: number;
  readonly byKind: Partial<
    Record<PerfOperationKind, { count: number; rps: number; errorRatePercent: number }>
  >;
  /** Highest-volume operations (bounded). */
  readonly busiest: readonly { operation: string; count: number; rps: number }[];
}

/** Cache-efficiency signals. */
export interface CacheAnalysis {
  readonly hits: number;
  readonly misses: number;
  readonly hitRatio: number;
  readonly p95Ms: number;
}

/** A slow query captured for the report. */
export interface SlowQueryRecord {
  readonly sql: string;
  readonly durationMs: number;
}

/** Process resource profile (event loop, memory, CPU, GC). */
export interface ResourceProfile {
  readonly uptimeSeconds: number;
  readonly startupMs: number | null;
  readonly eventLoopLagMeanMs: number;
  readonly eventLoopLagP95Ms: number;
  readonly rssBytes: number;
  readonly heapUsedBytes: number;
  readonly heapTotalBytes: number;
  readonly externalBytes: number;
  readonly cpuPercent: number;
  readonly gcCount: number;
  readonly gcTotalMs: number;
  readonly activeHandles: number;
}

/** The umbrella performance analysis — everything measured, one object. */
export interface PerformanceAnalysis {
  readonly generatedAt: string;
  readonly windowSeconds: number;
  readonly latency: LatencyAnalysis;
  readonly throughput: ThroughputAnalysis;
  readonly cache: CacheAnalysis;
  readonly resource: ResourceProfile;
  readonly slowQueries: readonly SlowQueryRecord[];
}

/** Verdict for one budget after verification. */
export interface BudgetVerdict {
  readonly id: string;
  readonly domain: BudgetDomain;
  readonly label: string;
  readonly metric: string;
  readonly target: number;
  readonly comparator: BudgetComparator;
  readonly unit: string;
  /** The measured value, or null when not server-measured / no data yet. */
  readonly measured: number | null;
  /** pass | fail | not_measured. */
  readonly status: 'pass' | 'fail' | 'not_measured';
}

/** Result of a full budget verification pass. */
export interface BudgetVerification {
  readonly generatedAt: string;
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly notMeasured: number;
  readonly verdicts: readonly BudgetVerdict[];
}

/** One resource's capacity position + scaling recommendation. */
export interface CapacityForecast {
  readonly resource: string;
  readonly label: string;
  readonly unit: string;
  readonly limit: number;
  readonly used: number;
  readonly utilizationPercent: number;
  readonly scaleAtPercent: number;
  /** True when utilization ≥ scaleAtPercent. */
  readonly shouldScale: boolean;
  readonly scaleLever: string;
  /** Naive linear headroom: how many more units before hitting the limit. */
  readonly headroom: number;
}

/** The capacity planning surface. */
export interface CapacityPlan {
  readonly generatedAt: string;
  readonly forecasts: readonly CapacityForecast[];
  readonly scalingRecommendations: readonly string[];
}

/** Timing statistics for a single benchmark scenario. */
export interface BenchmarkResult {
  readonly scenario: string;
  readonly iterations: number;
  readonly minMs: number;
  readonly meanMs: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly maxMs: number;
  readonly opsPerSecond: number;
}

/** A benchmark run (repeatable set of scenarios). */
export interface BenchmarkRun {
  readonly generatedAt: string;
  readonly environment: string;
  readonly results: readonly BenchmarkResult[];
}

/** The full performance report (Performance Report Generator output). */
export interface PerformanceReport {
  readonly generatedAt: string;
  readonly environment: string;
  readonly version: string;
  readonly analysis: PerformanceAnalysis;
  readonly budgets: BudgetVerification;
  readonly capacity: CapacityPlan;
  readonly benchmarks: BenchmarkRun | null;
  /** healthy | degraded | unhealthy — derived from budget verdicts. */
  readonly health: 'healthy' | 'degraded' | 'unhealthy';
}
