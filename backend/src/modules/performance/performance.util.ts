/**
 * Small pure helpers for the Performance Platform. Kept isolated so timestamp
 * formatting and the metric-value reader used by the budget pipeline live in one
 * place (and are trivially unit-testable).
 */
import type { PerformanceAnalysis } from './performance.types';

/** Current instant as an ISO-8601 string (single formatting point). */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Read a dot-path metric (e.g. `http.p95Ms`, `resource.heapUsedBytes`) off a
 * {@link PerformanceAnalysis} for budget verification. Returns null when the
 * metric has no measurement yet (so the verdict is `not_measured`, never a false
 * pass/fail). Centralizes the budget-metric mapping in ONE function.
 */
export function readMetric(analysis: PerformanceAnalysis, metric: string): number | null {
  switch (metric) {
    case 'http.p95Ms':
      return analysis.latency.byKind.http?.p95Ms ?? null;
    case 'http.p99Ms':
      return analysis.latency.byKind.http?.p99Ms ?? null;
    case 'http.errorRate':
      return analysis.throughput.byKind.http?.errorRatePercent ?? null;
    case 'db.slowQueryCount':
      return analysis.slowQueries.length;
    case 'cache.hitRatio':
      // Only a real signal once there has been cache traffic.
      return analysis.cache.hits + analysis.cache.misses > 0 ? analysis.cache.hitRatio : null;
    case 'cache.p95Ms':
      return analysis.latency.byKind.cache?.p95Ms ?? null;
    case 'queue.p95Ms':
      return analysis.latency.byKind.queue?.p95Ms ?? null;
    case 'search.p95Ms':
      return analysis.latency.byKind.search?.p95Ms ?? null;
    case 'ai.p95Ms':
      return analysis.latency.byKind.ai?.p95Ms ?? null;
    case 'storage.p95Ms':
      return analysis.latency.byKind.storage?.p95Ms ?? null;
    case 'resource.eventLoopLagP95Ms':
      return analysis.resource.eventLoopLagP95Ms;
    case 'resource.heapUsedBytes':
      return analysis.resource.heapUsedBytes;
    case 'resource.cpuPercent':
      return analysis.resource.cpuPercent;
    case 'resource.startupMs':
      return analysis.resource.startupMs;
    default:
      // Client-side / out-of-band metrics (frontend/flutter/ai.firstToken/…)
      // have no server measurement — verified by their own harnesses.
      return null;
  }
}
