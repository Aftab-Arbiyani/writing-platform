/**
 * Small pure helpers for the Operations Platform. Kept isolated so timestamp
 * formatting, id generation, and rounding live in one place (and are trivially
 * unit-testable).
 */
import { v7 as uuidv7 } from 'uuid';

import type { OperationalSignals } from './operations.types';

/** Current instant as an ISO-8601 string (single formatting point). */
export function nowIso(): string {
  return new Date().toISOString();
}

/** A time-ordered operational record id (mirrors the UUIDv7 PK convention). */
export function opsId(): string {
  return uuidv7();
}

/** Round to two decimals (money / percentages / ratios in reports). */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Round to four decimals (ratios rendered as Prometheus gauges). */
export function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

/** Clamp a number into [min, max]. */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Read a dot-path metric off the resolved {@link OperationalSignals} for SLO +
 * alert evaluation. Returns null when there is no live signal yet (so the
 * verdict is `no_data` / not-firing, never a false pass/fail). Centralizes the
 * metric→signal mapping in ONE function (the P7.3 `readMetric` pattern), so a
 * rule references a metric name and nothing re-measures.
 */
export function readSignal(signals: OperationalSignals, metric: string): number | null {
  switch (metric) {
    case 'api.availability':
      return signals.api.availability;
    case 'api.p95Ms':
      return signals.api.p95Ms;
    case 'api.p99Ms':
      return signals.api.p99Ms;
    case 'api.errorRatePercent':
      return signals.api.errorRatePercent;
    case 'api.successRate':
      return signals.api.successRate;
    case 'ai.availability':
      return signals.ai.availability;
    case 'ai.p95Ms':
      return signals.ai.p95Ms;
    case 'search.p95Ms':
      return signals.search.p95Ms;
    case 'payments.p95Ms':
      return signals.payments.p95Ms;
    case 'payments.successRate':
      return signals.payments.successRate;
    case 'cache.hitRatio':
      return signals.cache.hitRatio;
    case 'db.slowQueryCount':
      return signals.db.slowQueryCount;
    case 'runtime.eventLoopLagP95Ms':
      return signals.runtime.eventLoopLagP95Ms;
    case 'runtime.heapUsedBytes':
      return signals.runtime.heapUsedBytes;
    case 'runtime.cpuPercent':
      return signals.runtime.cpuPercent;
    case 'queue.oldestWaitingSeconds':
      return signals.queue.oldestWaitingSeconds;
    case 'capacity.shouldScaleCount':
      return signals.capacity.shouldScaleCount;
    case 'security.eventRatePerMin':
      return signals.security.eventRatePerMin;
    case 'cost.dailyUsd':
      return signals.cost.dailyUsd;
    default:
      return null;
  }
}
