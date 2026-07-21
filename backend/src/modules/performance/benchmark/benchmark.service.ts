import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { hrtime } from 'node:process';

import { deploymentConfig } from '../../../config/deployment.config';
import { performanceConfig } from '../../../config/performance.config';
import { buildBenchmarkScenarios, type BenchmarkScenario } from './benchmark-catalog';
import { statsFromSamples } from '../collector/performance-registry.service';
import { nowIso } from '../performance.util';
import type { BenchmarkResult, BenchmarkRun } from '../performance.types';

/**
 * Benchmark Service (P7.3) — runs the deterministic micro-benchmark catalogue a
 * fixed number of iterations and reports per-scenario timing (min/mean/p50/p95/
 * max + ops/sec). Uses `hrtime.bigint()` (monotonic, nanosecond) so results are
 * repeatable and comparable, satisfying "all benchmarks must be repeatable / DB
 * benchmarking / deterministic measurements". A short warm-up pass lets the JIT
 * settle before the measured pass, so numbers are stable.
 *
 * Execution is opt-in (`PERF_BENCHMARK_ENABLED`) and never runs automatically on
 * a request path — the admin surface reads the LAST run; the CLI
 * `backend/perf/run-benchmarks.ts` produces one for CI regression gating.
 */
@Injectable()
export class BenchmarkService {
  private readonly logger = new Logger(BenchmarkService.name);
  private readonly scenarios: readonly BenchmarkScenario[] = buildBenchmarkScenarios();
  private lastRun: BenchmarkRun | null = null;

  constructor(
    @Inject(performanceConfig.KEY) private readonly config: ConfigType<typeof performanceConfig>,
    @Inject(deploymentConfig.KEY) private readonly deployment: ConfigType<typeof deploymentConfig>,
  ) {}

  /** Scenario ids available to run. */
  scenarioIds(): string[] {
    return this.scenarios.map((s) => s.id);
  }

  /** The most recent benchmark run (null until one has been executed). */
  latest(): BenchmarkRun | null {
    return this.lastRun;
  }

  /** Run all (or a filtered subset of) scenarios deterministically. */
  run(only?: readonly string[]): BenchmarkRun {
    if (!this.config.benchmarkEnabled) {
      this.logger.warn('benchmark run requested but PERF_BENCHMARK_ENABLED=false');
    }
    const iterations = Math.max(1, this.config.benchmarkIterations);
    const scenarios =
      only && only.length > 0 ? this.scenarios.filter((s) => only.includes(s.id)) : this.scenarios;

    const results: BenchmarkResult[] = scenarios.map((s) => this.measure(s, iterations));
    const run: BenchmarkRun = {
      generatedAt: nowIso(),
      environment: this.deployment.environment,
      results,
    };
    this.lastRun = run;
    return run;
  }

  private measure(scenario: BenchmarkScenario, iterations: number): BenchmarkResult {
    // Warm-up (JIT) — a bounded fraction of the measured pass, not recorded.
    const warmup = Math.min(iterations, 200);
    for (let i = 0; i < warmup; i += 1) {
      scenario.run();
    }

    const samplesMs: number[] = new Array<number>(iterations);
    for (let i = 0; i < iterations; i += 1) {
      const start = hrtime.bigint();
      scenario.run();
      samplesMs[i] = Number(hrtime.bigint() - start) / 1e6;
    }

    const stats = statsFromSamples(samplesMs, iterations, 0);
    const opsPerSecond = stats.meanMs > 0 ? Math.round(1000 / stats.meanMs) : 0;
    return {
      scenario: scenario.id,
      iterations,
      minMs: stats.minMs,
      meanMs: stats.meanMs,
      p50Ms: stats.p50Ms,
      p95Ms: stats.p95Ms,
      maxMs: stats.maxMs,
      opsPerSecond,
    };
  }
}
