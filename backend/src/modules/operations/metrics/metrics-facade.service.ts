import { Injectable } from '@nestjs/common';

import { SignalCollectorService } from '../collector/signal-collector.service';
import { OPS_METRICS } from '../operations.constants';
import { nowIso } from '../operations.util';

/** One metric series for the admin Metrics viewer. */
export interface MetricSeries {
  readonly name: string;
  readonly value: number | null;
  readonly unit: string;
  /** Which platform measured it (transparency: all reuse, no re-measurement). */
  readonly source: string;
}

/** The structured metrics snapshot for the admin Metrics dashboard. */
export interface MetricsSnapshot {
  readonly generatedAt: string;
  readonly registry: string;
  readonly exposition: 'prometheus';
  readonly series: readonly MetricSeries[];
}

/**
 * Metrics Service (P7.4) — the operational metrics FACADE. It does NOT stand up a
 * new registry: application/API/DB/Redis/queue/AI/security metrics are exposed
 * through the EXISTING `/metrics` Prometheus endpoint (fed by the HTTP
 * interceptor, the Performance Platform's `metricLines`, the Security counters,
 * and this platform's registry). This service projects the SAME signals into a
 * structured snapshot for the admin Metrics viewer, and owns the ops metric-name
 * taxonomy ({@link OPS_METRICS}). No parallel collection.
 */
@Injectable()
export class MetricsFacadeService {
  constructor(private readonly signals: SignalCollectorService) {}

  /** The ops metric-name catalogue (for the Metrics viewer legend). */
  metricNames(): readonly string[] {
    return Object.values(OPS_METRICS);
  }

  /** A structured snapshot of the headline operational metric series. */
  async snapshot(): Promise<MetricsSnapshot> {
    const s = await this.signals.collect();
    const series: MetricSeries[] = [
      { name: 'api_latency_p95_ms', value: s.api.p95Ms, unit: 'ms', source: 'performance' },
      { name: 'api_latency_p99_ms', value: s.api.p99Ms, unit: 'ms', source: 'performance' },
      {
        name: 'api_error_rate_percent',
        value: s.api.errorRatePercent,
        unit: 'percent',
        source: 'performance',
      },
      {
        name: 'api_availability_ratio',
        value: s.api.availability,
        unit: 'ratio',
        source: 'performance',
      },
      { name: 'cache_hit_ratio', value: s.cache.hitRatio, unit: 'ratio', source: 'performance' },
      {
        name: 'db_slow_query_count',
        value: s.db.slowQueryCount,
        unit: 'count',
        source: 'performance',
      },
      {
        name: 'runtime_event_loop_lag_p95_ms',
        value: s.runtime.eventLoopLagP95Ms,
        unit: 'ms',
        source: 'performance',
      },
      {
        name: 'runtime_heap_used_bytes',
        value: s.runtime.heapUsedBytes,
        unit: 'bytes',
        source: 'performance',
      },
      {
        name: 'runtime_cpu_percent',
        value: s.runtime.cpuPercent,
        unit: 'percent',
        source: 'performance',
      },
      {
        name: 'queue_oldest_waiting_seconds',
        value: s.queue.oldestWaitingSeconds,
        unit: 'seconds',
        source: 'queue-monitor',
      },
      {
        name: 'capacity_should_scale_count',
        value: s.capacity.shouldScaleCount,
        unit: 'count',
        source: 'performance',
      },
      { name: 'ai_latency_p95_ms', value: s.ai.p95Ms, unit: 'ms', source: 'performance' },
      { name: 'search_latency_p95_ms', value: s.search.p95Ms, unit: 'ms', source: 'performance' },
      {
        name: 'payments_latency_p95_ms',
        value: s.payments.p95Ms,
        unit: 'ms',
        source: 'performance',
      },
      {
        name: 'security_event_rate_per_min',
        value: s.security.eventRatePerMin,
        unit: 'count',
        source: 'operations-registry',
      },
      {
        name: OPS_METRICS.costDailyUsd,
        value: s.cost.dailyUsd,
        unit: 'usd',
        source: 'cost-observability',
      },
    ];
    return {
      generatedAt: nowIso(),
      registry: '/metrics',
      exposition: 'prometheus',
      series,
    };
  }
}
