import type { ConfigType } from '@nestjs/config';

import type { operationsConfig } from '../../../config/operations.config';
import { OperationsTracerService } from './operations-tracer.service';

type OpsConfig = ConfigType<typeof operationsConfig>;

function make(sampleRate = 1, bufferSize = 200): OperationsTracerService {
  return new OperationsTracerService({
    tracing: { sampleRate, bufferSize, maxSpansPerTrace: 100 },
  } as OpsConfig);
}

describe('OperationsTracerService', () => {
  it('records a completed span and exposes it as a trace', () => {
    const tracer = make();
    const span = tracer.startSpan('GET /pieces/:id', { kind: 'http' });
    span.setAttribute('route', '/pieces/:id');
    span.end('ok');

    const traces = tracer.recentTraces();
    expect(traces).toHaveLength(1);
    expect(traces[0]?.rootName).toBe('GET /pieces/:id');
    expect(traces[0]?.status).toBe('ok');
    expect(tracer.trace(traces[0]!.traceId)?.spans[0]?.attributes.route).toBe('/pieces/:id');
  });

  it('marks the trace errored when a span errors', () => {
    const tracer = make();
    const span = tracer.startSpan('POST /ai/completions', { kind: 'ai' });
    span.setError('timeout');
    span.end();
    expect(tracer.recentTraces()[0]?.status).toBe('error');
  });

  it('nests a child span under a parent via trace context', () => {
    const tracer = make();
    const parent = tracer.startSpan('job', { kind: 'job' });
    const child = tracer.startSpan('db', { kind: 'db', context: parent.context });
    child.end('ok');
    parent.end('ok');
    const trace = tracer.trace(parent.context.traceId);
    expect(trace?.traceId).toBe(parent.context.traceId);
    expect(trace?.spans.some((s) => s.parentSpanId === parent.context.spanId)).toBe(true);
  });

  it('drops everything when the sample rate is 0', () => {
    const tracer = make(0);
    tracer.startSpan('x', { kind: 'http' }).end('ok');
    expect(tracer.recentTraces()).toHaveLength(0);
    expect(tracer.stats().sampledTotal).toBe(0);
  });

  it('evicts the oldest traces beyond the buffer size', () => {
    const tracer = make(1, 2);
    for (let i = 0; i < 5; i += 1) {
      tracer.startSpan(`op-${i}`, { kind: 'http' }).end('ok');
    }
    expect(tracer.stats().tracesRetained).toBeLessThanOrEqual(2);
  });

  it('reports the configured sample rate in stats', () => {
    expect(make(0.25).stats().sampleRate).toBe(0.25);
  });
});
