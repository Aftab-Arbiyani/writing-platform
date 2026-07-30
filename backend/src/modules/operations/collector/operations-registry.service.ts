import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import type {
  OperationsObserver,
  OpsSignal,
} from '../../../common/operations/operations-observer.port';
import { operationsConfig } from '../../../config/operations.config';
import { OPS_METRICS } from '../operations.constants';
import { round2 } from '../operations.util';

/** A rolling counter for one signal name (ok/total + last value + first-seen). */
interface SignalCounter {
  total: number;
  ok: number;
  failures: number;
  sum: number;
  last: number;
  firstAtMs: number;
}

/**
 * The Operations Platform's in-memory telemetry sink and read model (P7.4).
 * Implements the single {@link OperationsObserver} seam every emission point
 * feeds — deployment/config/rollout events, classified failures, security-signal
 * surges, and SLI outcomes performance does not already model — so operational
 * signals converge in ONE place, with no per-service alerting/SLO/incident logic
 * duplicated anywhere.
 *
 * It deliberately holds ONLY the signals the reused platforms don't (latency /
 * error-rate / cache / slow-queries / capacity all come from the Performance
 * Platform via the SignalCollector). Memory is bounded (a counter per stable,
 * low-cardinality signal name). Every method is allocation-light and NEVER throws
 * (a measurement must not fail the measured path).
 */
@Injectable()
export class OperationsRegistryService implements OperationsObserver {
  private readonly counters = new Map<string, SignalCounter>();
  private readonly startedAtMs = Date.now();

  constructor(
    @Inject(operationsConfig.KEY)
    private readonly config: ConfigType<typeof operationsConfig>,
  ) {}

  // ── Ingestion (OperationsObserver) ────────────────────────────────────────

  record(signal: OpsSignal): void {
    if (!this.config.enabled) {
      return;
    }
    try {
      const c = this.counter(signal.name);
      c.total += 1;
      if (signal.ok) {
        c.ok += 1;
      } else {
        c.failures += 1;
      }
      if (typeof signal.value === 'number' && Number.isFinite(signal.value)) {
        c.sum += signal.value;
        c.last = signal.value;
      }
    } catch {
      // Telemetry must never disrupt the measured operation.
    }
  }

  // ── Read model ────────────────────────────────────────────────────────────

  /** Total occurrences of a signal since start (0 when unseen). */
  count(name: string): number {
    return this.counters.get(name)?.total ?? 0;
  }

  /** Failure occurrences of a signal since start. */
  failures(name: string): number {
    return this.counters.get(name)?.failures ?? 0;
  }

  /** Sum of the numeric values recorded for a signal. */
  sum(name: string): number {
    return this.counters.get(name)?.sum ?? 0;
  }

  /** Per-minute rate of a signal over its observed lifetime, or null if unseen. */
  ratePerMinute(name: string): number | null {
    const c = this.counters.get(name);
    if (c === undefined || c.total === 0) {
      return null;
    }
    const minutes = Math.max(1 / 60, (Date.now() - c.firstAtMs) / 60_000);
    return round2(c.total / minutes);
  }

  /** Every counter as a plain object (governance / debug view). */
  snapshot(): Record<string, { total: number; ok: number; failures: number; last: number }> {
    const out: Record<string, { total: number; ok: number; failures: number; last: number }> = {};
    for (const [name, c] of this.counters) {
      out[name] = { total: c.total, ok: c.ok, failures: c.failures, last: c.last };
    }
    return out;
  }

  /** Seconds since the registry started collecting. */
  collectionSeconds(): number {
    return Math.max(1, Math.round((Date.now() - this.startedAtMs) / 1000));
  }

  /** Prometheus text lines for the shared `/metrics` registry (observability). */
  metricLines(): string[] {
    const out: string[] = [];
    out.push(`# HELP ${OPS_METRICS.deploymentsTotal} Deployment/change events recorded (P7.4).`);
    out.push(`# TYPE ${OPS_METRICS.deploymentsTotal} counter`);
    out.push(`${OPS_METRICS.deploymentsTotal} ${this.count('deploy.recorded')}`);
    return out;
  }

  /** Test/ops hook — clear all collected counters (deterministic re-runs). */
  reset(): void {
    this.counters.clear();
  }

  private counter(name: string): SignalCounter {
    let c = this.counters.get(name);
    if (c === undefined) {
      c = { total: 0, ok: 0, failures: 0, sum: 0, last: 0, firstAtMs: Date.now() };
      this.counters.set(name, c);
    }
    return c;
  }
}
