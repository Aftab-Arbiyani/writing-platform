import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import {
  type PerfOperationKind,
  type PerformanceObserver,
  type PerformanceSample,
  type SlowQuerySample,
} from '../../../common/performance/performance-observer.port';
import { performanceConfig } from '../../../config/performance.config';
import {
  LATENCY_RESERVOIR_SIZE,
  PERF_METRICS,
  SLOW_QUERY_BUFFER_SIZE,
} from '../performance.constants';
import type { LatencyStats, OperationStats } from '../performance.types';

/** Bounded reservoir of latency samples for one operation + its counters. */
interface OperationBucket {
  kind: PerfOperationKind;
  count: number;
  errorCount: number;
  /** Ring buffer of recent durations (bounded — no unbounded memory growth). */
  samples: number[];
  cursor: number;
}

/**
 * The Performance Platform's in-memory telemetry sink and read model (P7.3).
 * Implements the single {@link PerformanceObserver} seam every measurement point
 * feeds — HTTP (via MetricsService), cache, queue workers, and the TypeORM
 * slow-query logger — so all timing data converges in ONE place, computed once,
 * with no per-service optimization/aggregation logic duplicated anywhere.
 *
 * Memory is bounded: each operation keeps a fixed-size ring buffer
 * ({@link LATENCY_RESERVOIR_SIZE}); slow queries a small ring
 * ({@link SLOW_QUERY_BUFFER_SIZE}). Percentiles are computed on read from the
 * live reservoir — deterministic given the same samples, repeatable for tests.
 * Every method is allocation-light and NEVER throws (a measurement must not fail
 * the measured path).
 */
@Injectable()
export class PerformanceRegistryService implements PerformanceObserver {
  private readonly operations = new Map<string, OperationBucket>();
  private cacheHits = 0;
  private cacheMisses = 0;
  private slowQueries: SlowQuerySample[] = [];
  private slowQueryCursor = 0;
  private slowQueryTotal = 0;
  private readonly startedAtMs = Date.now();

  constructor(
    @Inject(performanceConfig.KEY)
    private readonly config: ConfigType<typeof performanceConfig>,
  ) {}

  // ── Ingestion (PerformanceObserver) ──────────────────────────────────────

  observe(sample: PerformanceSample): void {
    if (!this.config.enabled) {
      return;
    }
    try {
      const bucket = this.bucket(sample.operation, sample.kind);
      bucket.count += 1;
      if (!sample.ok) {
        bucket.errorCount += 1;
      }
      const d = Number.isFinite(sample.durationMs) ? Math.max(0, sample.durationMs) : 0;
      if (bucket.samples.length < LATENCY_RESERVOIR_SIZE) {
        bucket.samples.push(d);
      } else {
        bucket.samples[bucket.cursor] = d;
        bucket.cursor = (bucket.cursor + 1) % LATENCY_RESERVOIR_SIZE;
      }
    } catch {
      // Telemetry must never disrupt the measured operation.
    }
  }

  recordCache(hit: boolean): void {
    if (!this.config.enabled) {
      return;
    }
    if (hit) {
      this.cacheHits += 1;
    } else {
      this.cacheMisses += 1;
    }
  }

  recordSlowQuery(sample: SlowQuerySample): void {
    if (!this.config.enabled) {
      return;
    }
    this.slowQueryTotal += 1;
    if (this.slowQueries.length < SLOW_QUERY_BUFFER_SIZE) {
      this.slowQueries.push(sample);
    } else {
      this.slowQueries[this.slowQueryCursor] = sample;
      this.slowQueryCursor = (this.slowQueryCursor + 1) % SLOW_QUERY_BUFFER_SIZE;
    }
  }

  // ── Read model ───────────────────────────────────────────────────────────

  /** Seconds since the registry started collecting (bounds rate math). */
  collectionSeconds(): number {
    return Math.max(1, Math.round((Date.now() - this.startedAtMs) / 1000));
  }

  cacheStats(): { hits: number; misses: number; hitRatio: number; p95Ms: number } {
    const total = this.cacheHits + this.cacheMisses;
    const cacheOps = this.operationStats().filter((o) => o.kind === 'cache');
    const p95Ms = cacheOps.length > 0 ? Math.max(...cacheOps.map((o) => o.p95Ms)) : 0;
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRatio: total === 0 ? 1 : this.cacheHits / total,
      p95Ms,
    };
  }

  slowQuerySnapshot(): { total: number; recent: SlowQuerySample[] } {
    return { total: this.slowQueryTotal, recent: [...this.slowQueries] };
  }

  /** Per-operation stats (percentiles computed from the live reservoir). */
  operationStats(): OperationStats[] {
    const out: OperationStats[] = [];
    for (const [operation, bucket] of this.operations) {
      out.push({ operation, kind: bucket.kind, ...statsOf(bucket) });
    }
    return out;
  }

  /** Aggregate latency stats across a predicate (all ops / one kind). */
  aggregate(predicate?: (kind: PerfOperationKind) => boolean): LatencyStats {
    const merged: number[] = [];
    let count = 0;
    let errorCount = 0;
    for (const bucket of this.operations.values()) {
      if (predicate && !predicate(bucket.kind)) {
        continue;
      }
      count += bucket.count;
      errorCount += bucket.errorCount;
      merged.push(...bucket.samples);
    }
    return statsFromSamples(merged, count, errorCount);
  }

  /** Prometheus text lines for the shared `/metrics` registry (observability). */
  metricLines(): string[] {
    const out: string[] = [];
    const ops = this.operationStats();

    out.push(`# HELP ${PERF_METRICS.operationTotal} Performance operations by kind (P7.3).`);
    out.push(`# TYPE ${PERF_METRICS.operationTotal} counter`);
    out.push(`# HELP ${PERF_METRICS.operationLatency} Operation latency p95 seconds by kind.`);
    out.push(`# TYPE ${PERF_METRICS.operationLatency} gauge`);
    const kinds = new Map<PerfOperationKind, { count: number; p95: number }>();
    for (const o of ops) {
      const acc = kinds.get(o.kind) ?? { count: 0, p95: 0 };
      acc.count += o.count;
      acc.p95 = Math.max(acc.p95, o.p95Ms);
      kinds.set(o.kind, acc);
    }
    for (const [kind, v] of kinds) {
      out.push(`${PERF_METRICS.operationTotal}{kind="${kind}"} ${v.count}`);
      out.push(`${PERF_METRICS.operationLatency}{kind="${kind}"} ${(v.p95 / 1000).toFixed(4)}`);
    }

    const cache = this.cacheStats();
    out.push(`# HELP ${PERF_METRICS.cacheHitRatio} Cache hit ratio (P7.3).`);
    out.push(`# TYPE ${PERF_METRICS.cacheHitRatio} gauge`);
    out.push(`${PERF_METRICS.cacheHitRatio} ${cache.hitRatio.toFixed(4)}`);

    out.push(`# HELP ${PERF_METRICS.slowQueries} Slow queries detected (P7.3).`);
    out.push(`# TYPE ${PERF_METRICS.slowQueries} counter`);
    out.push(`${PERF_METRICS.slowQueries} ${this.slowQueryTotal}`);

    return out;
  }

  /** Test/ops hook — clear all collected telemetry (deterministic re-runs). */
  reset(): void {
    this.operations.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.slowQueries = [];
    this.slowQueryCursor = 0;
    this.slowQueryTotal = 0;
  }

  private bucket(operation: string, kind: PerfOperationKind): OperationBucket {
    let b = this.operations.get(operation);
    if (b === undefined) {
      b = { kind, count: 0, errorCount: 0, samples: [], cursor: 0 };
      this.operations.set(operation, b);
    }
    return b;
  }
}

/** Percentile stats for one bucket. */
function statsOf(bucket: OperationBucket): LatencyStats {
  return statsFromSamples(bucket.samples, bucket.count, bucket.errorCount);
}

/**
 * Compute latency stats from a sample array. `count`/`errorCount` are the true
 * totals (the reservoir may be smaller than the observed count). Percentiles use
 * nearest-rank on the sorted reservoir — deterministic for identical input.
 */
export function statsFromSamples(
  samples: readonly number[],
  count: number,
  errorCount: number,
): LatencyStats {
  if (samples.length === 0) {
    return { count, errorCount, minMs: 0, meanMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, maxMs: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    count,
    errorCount,
    minMs: round2(sorted[0] ?? 0),
    meanMs: round2(sum / sorted.length),
    p50Ms: round2(percentile(sorted, 50)),
    p95Ms: round2(percentile(sorted, 95)),
    p99Ms: round2(percentile(sorted, 99)),
    maxMs: round2(sorted[sorted.length - 1] ?? 0),
  };
}

/** Nearest-rank percentile of an already-sorted array. */
function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const rank = Math.ceil((p / 100) * sorted.length);
  const index = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[index] ?? 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
