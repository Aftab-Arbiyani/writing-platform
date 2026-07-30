import { Injectable } from '@nestjs/common';

import { OperationsTracerService } from './operations-tracer.service';
import type { RecordedTrace } from '../operations.types';

/**
 * Distributed Tracing Service (P7.4) — the read surface over the in-memory trace
 * store the {@link OperationsTracerService} fills through the single `Tracer`
 * seam. Backs the admin Tracing viewer. It only reads; span recording is the
 * tracer's job, reached DI-lessly by every instrumentation point so tracing is
 * centralized and never duplicated per service.
 */
@Injectable()
export class TracingService {
  constructor(private readonly tracer: OperationsTracerService) {}

  /** Recent traces, newest first (bounded read model). */
  recent(limit = 50): RecordedTrace[] {
    return this.tracer.recentTraces(limit);
  }

  /** One trace by id (null when evicted / never sampled). */
  get(traceId: string): RecordedTrace | null {
    return this.tracer.trace(traceId);
  }

  /** Tracing posture numbers (retained traces/spans + sample rate). */
  posture(): {
    tracesRetained: number;
    spansRetained: number;
    sampledTotal: number;
    sampleRate: number;
  } {
    return this.tracer.stats();
  }
}
