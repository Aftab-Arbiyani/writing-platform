/**
 * Performance Platform config namespace (P7.3). Every tunable the platform
 * needs, environment-overridable with documented defaults, read lazily from
 * `process.env` (mirroring infrastructure.config.ts). Nothing here is a secret,
 * so the Zod env schema stays non-strict and lets these pass through.
 *
 * Consumers inject `ConfigType<typeof performanceConfig>`. The datasource
 * factory also reads `slowQueryMs` to set TypeORM `maxQueryExecutionTime`.
 */
import { registerAs } from '@nestjs/config';

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  return raw === 'true' || raw === '1';
}

export const performanceConfig = registerAs('performance', () => ({
  /** Master switch — when false the registry ignores samples (zero overhead). */
  enabled: bool('PERF_ENABLED', true),
  /**
   * Slow-query threshold (ms). Wired into TypeORM `maxQueryExecutionTime`; any
   * query above it is captured for slow-query detection. 0 disables capture.
   */
  slowQueryMs: num('PERF_SLOW_QUERY_MS', 200),
  /** Rolling analysis window (seconds) used for throughput rate math. */
  windowSeconds: num('PERF_WINDOW_SECONDS', 300),
  /** Event-loop-lag sampler interval (ms). 0 disables the sampler. */
  eventLoopSampleMs: num('PERF_EVENT_LOOP_SAMPLE_MS', 2000),
  /** Whether benchmarks may be run in-process via the admin trigger / script. */
  benchmarkEnabled: bool('PERF_BENCHMARK_ENABLED', true),
  /** Iterations per micro-benchmark scenario (repeatability vs runtime). */
  benchmarkIterations: num('PERF_BENCHMARK_ITERATIONS', 2000),
  /**
   * Capacity ceilings — override the documented single-VM defaults per
   * deployment. 0 = use the {@link CAPACITY_MODELS} default for that resource.
   */
  capacity: {
    apiRps: num('PERF_CAP_API_RPS', 0),
    workers: num('PERF_CAP_WORKERS', 0),
    redisMemoryBytes: num('PERF_CAP_REDIS_MEMORY_BYTES', 0),
    aiTokensDaily: num('PERF_CAP_AI_TOKENS_DAILY', 0),
  },
}));
