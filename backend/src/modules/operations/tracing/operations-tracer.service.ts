import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { v7 as uuidv7 } from 'uuid';

import type {
  Span,
  SpanStatus,
  StartSpanOptions,
  TraceContext,
  Tracer,
} from '../../../common/operations/tracing.port';
import { operationsConfig } from '../../../config/operations.config';
import type { RecordedSpan, RecordedTrace } from '../operations.types';
import { round2 } from '../operations.util';

/** A trace under construction / recently completed (bounded read model). */
interface TraceBucket {
  traceId: string;
  startedAtMs: number;
  startedAtIso: string;
  spans: RecordedSpan[];
}

/**
 * The Operations Platform's distributed tracer (P7.4). Implements the single,
 * OTel-shaped {@link Tracer} seam every instrumentation point reaches via
 * `getTracer()?.startSpan(...)`. Spans are recorded into a bounded in-memory
 * ring of recent traces (the admin Tracing viewer's read model) — deterministic,
 * dependency-free, and forward-compatible: swapping this for an OTel SDK
 * exporter (→ Jaeger / Tempo / Datadog) is a factory swap, no call-site change.
 *
 * Sampling is head-based (`OPS_TRACE_SAMPLE_RATE`); Sentry already carries the
 * production trace export (`instrument.ts` `tracesSampleRate`) so this store is
 * the local, queryable view, not a parallel collector. Never throws.
 */
@Injectable()
export class OperationsTracerService implements Tracer {
  private readonly traces = new Map<string, TraceBucket>();
  private order: string[] = [];
  private sampledTotal = 0;

  constructor(
    @Inject(operationsConfig.KEY)
    private readonly config: ConfigType<typeof operationsConfig>,
  ) {}

  startSpan(name: string, options: StartSpanOptions): Span {
    const context: TraceContext = options.context ?? {
      traceId: uuidv7(),
      spanId: shortId(),
    };
    const spanContext: TraceContext = {
      traceId: context.traceId,
      spanId: context.spanId === '' ? shortId() : context.spanId,
      parentSpanId: context.parentSpanId,
    };
    // If a parent context was supplied without a fresh span id, mint one so the
    // child never collides with its parent.
    if (options.context !== undefined) {
      (spanContext as { spanId: string }).spanId = shortId();
      (spanContext as { parentSpanId?: string }).parentSpanId = options.context.spanId;
    }

    const startedAtMs = Date.now();
    const attributes: Record<string, string | number | boolean> = { ...(options.attributes ?? {}) };
    let errorType: string | undefined;
    let ended = false;

    const record = (status: SpanStatus): void => {
      if (ended || !this.shouldSample(spanContext.traceId)) {
        ended = true;
        return;
      }
      ended = true;
      if (errorType !== undefined) {
        attributes['error.type'] = errorType;
      }
      this.push(spanContext, {
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
        parentSpanId: spanContext.parentSpanId ?? null,
        name,
        kind: options.kind,
        durationMs: round2(Date.now() - startedAtMs),
        status,
        startedAt: new Date(startedAtMs).toISOString(),
        attributes,
      });
    };

    return {
      context: spanContext,
      setAttribute: (key, value) => {
        attributes[key] = value;
      },
      setError: (type) => {
        errorType = type ?? 'error';
      },
      end: (status) => record(status ?? (errorType !== undefined ? 'error' : 'ok')),
    };
  }

  // ── Read model ────────────────────────────────────────────────────────────

  /** Recent reconstructed traces, newest first (bounded). */
  recentTraces(limit = 50): RecordedTrace[] {
    const ids = [...this.order].reverse().slice(0, limit);
    return ids
      .map((id) => this.assemble(this.traces.get(id)))
      .filter((t): t is RecordedTrace => t !== null);
  }

  /** One trace by id (null when evicted / never sampled). */
  trace(traceId: string): RecordedTrace | null {
    return this.assemble(this.traces.get(traceId));
  }

  /** Tracing posture numbers for the observability report. */
  stats(): {
    tracesRetained: number;
    spansRetained: number;
    sampledTotal: number;
    sampleRate: number;
  } {
    let spans = 0;
    for (const t of this.traces.values()) {
      spans += t.spans.length;
    }
    return {
      tracesRetained: this.traces.size,
      spansRetained: spans,
      sampledTotal: this.sampledTotal,
      sampleRate: this.config.tracing.sampleRate,
    };
  }

  reset(): void {
    this.traces.clear();
    this.order = [];
    this.sampledTotal = 0;
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  /** Deterministic head sampling keyed on the trace id (whole trace in/out). */
  private shouldSample(traceId: string): boolean {
    const rate = this.config.tracing.sampleRate;
    if (rate >= 1) {
      return true;
    }
    if (rate <= 0) {
      return false;
    }
    // Stable per-trace decision (FNV-1a → [0,1)); the same trace never splits.
    let hash = 0x811c9dc5;
    for (let i = 0; i < traceId.length; i += 1) {
      hash ^= traceId.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0) / 0xffffffff < rate;
  }

  private push(context: TraceContext, span: RecordedSpan): void {
    let bucket = this.traces.get(context.traceId);
    if (bucket === undefined) {
      bucket = {
        traceId: context.traceId,
        startedAtMs: Date.now(),
        startedAtIso: span.startedAt,
        spans: [],
      };
      this.traces.set(context.traceId, bucket);
      this.order.push(context.traceId);
      this.sampledTotal += 1;
      this.evict();
    }
    if (bucket.spans.length < this.config.tracing.maxSpansPerTrace) {
      bucket.spans.push(span);
    }
  }

  /** Drop the oldest traces when over the buffer size. */
  private evict(): void {
    const max = this.config.tracing.bufferSize;
    while (this.order.length > max) {
      const oldest = this.order.shift();
      if (oldest !== undefined) {
        this.traces.delete(oldest);
      }
    }
  }

  private assemble(bucket: TraceBucket | undefined): RecordedTrace | null {
    if (bucket === undefined || bucket.spans.length === 0) {
      return null;
    }
    const spans = [...bucket.spans].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    const root = spans.find((s) => s.parentSpanId === null) ?? spans[0];
    if (root === undefined) {
      return null;
    }
    const durationMs = Math.max(...spans.map((s) => s.durationMs));
    const status: SpanStatus = spans.some((s) => s.status === 'error') ? 'error' : 'ok';
    return {
      traceId: bucket.traceId,
      rootName: root.name,
      spanCount: spans.length,
      durationMs,
      status,
      startedAt: bucket.startedAtIso,
      spans,
    };
  }
}

/** Short, collision-resistant span id (first segment of a uuidv7). */
function shortId(): string {
  return uuidv7().replace(/-/g, '').slice(0, 16);
}
