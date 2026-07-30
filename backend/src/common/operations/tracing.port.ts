/**
 * The single, dependency-free distributed-tracing seam (P7.4). Lives in `common/`
 * so any layer — HTTP handlers, background jobs, DB/cache/queue/AI/search/storage
 * operations, external calls — can open a span WITHOUT importing the Operations
 * Platform (one-way arrow, no cycle), mirroring the `PERFORMANCE_OBSERVER` seam.
 *
 * The shape deliberately mirrors OpenTelemetry (`Tracer.startSpan` → `Span` with
 * attributes / status / `end()`), so swapping the in-process tracer for an OTel
 * SDK (→ Jaeger / Tempo / Datadog / Honeycomb) is a factory swap with no
 * call-site change — the "future compatibility without architectural change"
 * mandate, enforced structurally. Trace ids are seeded from the existing
 * `X-Request-Id` correlation id (ADR §9) so a trace stitches to its logs.
 *
 * Every method is fire-and-forget and MUST NOT throw; `getTracer()` returns
 * `undefined` until the platform registers a tracer, so `getTracer()?.startSpan`
 * is a no-op on minimal boots and unit tests.
 */

/** The subsystem a span belongs to (drives per-kind trace rollups). */
export type SpanKind =
  | 'http'
  | 'job'
  | 'db'
  | 'cache'
  | 'queue'
  | 'ai'
  | 'search'
  | 'storage'
  | 'payment'
  | 'auth'
  | 'authz'
  | 'external';

/** Span status — mirrors OTel's `ok | error | unset`. */
export type SpanStatus = 'ok' | 'error';

/** Immutable trace context propagated across process/queue boundaries. */
export interface TraceContext {
  /** 1:1 with the request correlation id (`X-Request-Id`) at the HTTP edge. */
  readonly traceId: string;
  /** This span's id. */
  readonly spanId: string;
  /** The parent span's id, when this span is nested. */
  readonly parentSpanId?: string;
}

/** Options when starting a span. */
export interface StartSpanOptions {
  readonly kind: SpanKind;
  /** Explicit parent/trace context (e.g. reconstructed on a queue worker). */
  readonly context?: TraceContext;
  /** Low-cardinality attributes (never PII / secrets / raw ids). */
  readonly attributes?: Readonly<Record<string, string | number | boolean>>;
}

/** A live span. `end()` records duration + status into the trace store. */
export interface Span {
  readonly context: TraceContext;
  /** Attach an attribute after start (never PII / secrets). */
  setAttribute(key: string, value: string | number | boolean): void;
  /** Mark the span errored (records the class of error, never the message/PII). */
  setError(errorType?: string): void;
  /** Finish the span (idempotent); records latency + status. */
  end(status?: SpanStatus): void;
}

/** The tracer the platform implements; call sites reach it via {@link getTracer}. */
export interface Tracer {
  /** Start a span. Returns a live {@link Span} whose `end()` records it. */
  startSpan(name: string, options: StartSpanOptions): Span;
}

let activeTracer: Tracer | undefined;

/** Wire the live tracer (called once by `OperationsModule.onModuleInit`). */
export function registerTracer(tracer: Tracer): void {
  activeTracer = tracer;
}

/** The live tracer, or `undefined` until the platform registers one. */
export function getTracer(): Tracer | undefined {
  return activeTracer;
}

/** DI token for the same tracer, for Nest providers that prefer injection. */
export const TRACER = Symbol('TRACER');
