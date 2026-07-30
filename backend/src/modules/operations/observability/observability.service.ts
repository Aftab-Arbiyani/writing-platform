import { Injectable } from '@nestjs/common';

import { LoggingService } from '../logging/logging.service';
import { MetricsFacadeService } from '../metrics/metrics-facade.service';
import { TracingService } from '../tracing/tracing.service';
import type { ObservabilityPosture } from '../operations.types';
import { nowIso } from '../operations.util';

/**
 * Observability Service (P7.4) — the umbrella over the three observability
 * pillars (metrics + logs + traces). It composes the Metrics facade, the Logging
 * policy service, and the Tracing read service into ONE posture object; it owns
 * no measurement itself. This is the single answer to "is the platform
 * observable?" — every production service emits metrics (shared `/metrics`),
 * structured logs (Pino → stdout), and traces (the `Tracer` seam), and this
 * reports that they are.
 */
@Injectable()
export class ObservabilityService {
  constructor(
    private readonly metrics: MetricsFacadeService,
    private readonly logging: LoggingService,
    private readonly tracing: TracingService,
  ) {}

  /** The observability posture (read-only). */
  posture(): ObservabilityPosture {
    const log = this.logging.posture();
    const trace = this.tracing.posture();
    return {
      generatedAt: nowIso(),
      metrics: {
        exposed: true,
        endpoint: '/metrics',
        series: this.metrics.metricNames().length,
      },
      logging: {
        structured: log.structured,
        format: 'json',
        sampleRate: log.sampleRate,
        retentionDays: log.retentionDays,
        redactionEnforced: log.redactionEnforced,
        classes: log.classes.map((c) => c.class),
      },
      tracing: {
        enabled: true,
        sampleRate: trace.sampleRate,
        tracesRetained: trace.tracesRetained,
        spansRetained: trace.spansRetained,
      },
    };
  }
}
