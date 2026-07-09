import { Injectable, Logger } from '@nestjs/common';

import { QueueMonitorService } from './queue-monitor.service';

/**
 * Lightweight in-process metrics registry exposed in Prometheus text-exposition
 * format at `GET /metrics` (docs 14 §4). Dependency-free (no `prom-client` — the
 * docs slot that for the Phase-1.5 Prometheus rollout; the taxonomy here is
 * forward-compatible so dashboards built now keep working). HTTP counters are
 * fed by {@link MetricsInterceptor}; BullMQ + process gauges are sampled at
 * scrape time.
 */
@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly requestsTotal = new Map<string, number>();
  private durationSumMs = 0;
  private durationCount = 0;
  private errorsTotal = 0;

  constructor(private readonly monitor: QueueMonitorService) {}

  /** Record one completed HTTP request (called from the interceptor). */
  record(method: string, statusCode: number, durationMs: number): void {
    const key = `${method}|${statusCode}`;
    this.requestsTotal.set(key, (this.requestsTotal.get(key) ?? 0) + 1);
    this.durationSumMs += durationMs;
    this.durationCount += 1;
    if (statusCode >= 500) {
      this.errorsTotal += 1;
    }
  }

  /** Render the full metrics snapshot in Prometheus text format. */
  async render(): Promise<string> {
    const out: string[] = [];

    out.push('# HELP http_requests_total Total HTTP requests by method and status.');
    out.push('# TYPE http_requests_total counter');
    for (const [key, value] of this.requestsTotal) {
      const [method, status] = key.split('|');
      out.push(`http_requests_total{method="${method}",status="${status}"} ${value}`);
    }

    out.push('# HELP http_errors_total Total HTTP 5xx responses.');
    out.push('# TYPE http_errors_total counter');
    out.push(`http_errors_total ${this.errorsTotal}`);

    out.push('# HELP http_request_duration_seconds Cumulative request duration.');
    out.push('# TYPE http_request_duration_seconds summary');
    out.push(`http_request_duration_seconds_sum ${(this.durationSumMs / 1000).toFixed(3)}`);
    out.push(`http_request_duration_seconds_count ${this.durationCount}`);

    const mem = process.memoryUsage();
    out.push('# TYPE process_resident_memory_bytes gauge');
    out.push(`process_resident_memory_bytes ${mem.rss}`);
    out.push('# TYPE nodejs_heap_used_bytes gauge');
    out.push(`nodejs_heap_used_bytes ${mem.heapUsed}`);
    out.push('# TYPE process_uptime_seconds gauge');
    out.push(`process_uptime_seconds ${Math.round(process.uptime())}`);

    await this.appendQueueMetrics(out);

    return `${out.join('\n')}\n`;
  }

  /** BullMQ gauges — best-effort (skipped if the queue Redis is unreachable). */
  private async appendQueueMetrics(out: string[]): Promise<void> {
    try {
      const queues = await this.monitor.listQueues();
      out.push('# HELP bullmq_queue_depth Jobs per queue by state.');
      out.push('# TYPE bullmq_queue_depth gauge');
      for (const q of queues) {
        for (const [state, count] of Object.entries(q.counts)) {
          out.push(`bullmq_queue_depth{queue="${q.name}",state="${state}"} ${count}`);
        }
      }
      out.push('# HELP bullmq_oldest_waiting_age_seconds Age of the oldest waiting job.');
      out.push('# TYPE bullmq_oldest_waiting_age_seconds gauge');
      for (const q of queues) {
        out.push(
          `bullmq_oldest_waiting_age_seconds{queue="${q.name}"} ${Math.round(q.oldestWaitingAgeMs / 1000)}`,
        );
      }
      out.push('# HELP bullmq_workers Connected workers per queue.');
      out.push('# TYPE bullmq_workers gauge');
      for (const q of queues) {
        out.push(`bullmq_workers{queue="${q.name}"} ${q.workers}`);
      }
    } catch (error) {
      this.logger.warn(`queue metrics unavailable: ${(error as Error).message}`);
    }
  }
}
