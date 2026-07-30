import { AdvancedConsoleLogger } from 'typeorm';
import type { LoggerOptions } from 'typeorm';

import { getPerformanceObserver } from '../common/performance/performance-observer.port';

/** Max SQL text length forwarded to telemetry (never carries bound values). */
const SQL_SNIPPET_MAX = 300;

/**
 * TypeORM logger (P7.3) that preserves the default console logging behaviour
 * but ALSO forwards any query exceeding `maxQueryExecutionTime` (set from
 * `PERF_SLOW_QUERY_MS`) to the Performance Platform through the shared,
 * DI-less observer seam — the single "slow-query detection" point. It runs
 * inside the datasource factory (before Nest DI), so it reaches the platform via
 * `getPerformanceObserver()` (a no-op until the platform registers itself),
 * never via injection. The forwarded SQL is truncated and parameter-free.
 */
export class PerformanceQueryLogger extends AdvancedConsoleLogger {
  constructor(options?: LoggerOptions) {
    super(options);
  }

  logQuerySlow(time: number, query: string, parameters?: unknown[]): void {
    getPerformanceObserver()?.recordSlowQuery({
      sql: query.slice(0, SQL_SNIPPET_MAX),
      durationMs: time,
    });
    // Keep TypeORM's own slow-query console warning (respects logging options).
    super.logQuerySlow(time, query, parameters);
  }
}
