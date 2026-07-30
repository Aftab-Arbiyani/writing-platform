/**
 * Deterministic benchmark runner (P7.3). Runs the Performance Platform's
 * micro-benchmark catalogue OUTSIDE the Nest app (no DB/Redis/HTTP) so it is
 * repeatable and CI-friendly, and prints the {@link BenchmarkRun} as JSON.
 *
 *   pnpm --filter backend exec ts-node -r tsconfig-paths/register perf/run-benchmarks.ts [--out perf/latest.json] [--iterations 2000]
 *
 * Pair with `check-regression.ts` to gate PRs against `performance-baseline.json`.
 */
import { writeFileSync } from 'node:fs';

import type { ConfigType } from '@nestjs/config';

import type { deploymentConfig } from '../src/config/deployment.config';
import type { performanceConfig } from '../src/config/performance.config';
import { BenchmarkService } from '../src/modules/performance/benchmark/benchmark.service';

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const iterations = Number(arg('--iterations') ?? process.env.PERF_BENCHMARK_ITERATIONS ?? 2000);
const outPath = arg('--out');

const perf = {
  benchmarkEnabled: true,
  benchmarkIterations: Number.isFinite(iterations) ? iterations : 2000,
} as ConfigType<typeof performanceConfig>;

const deployment = {
  environment: process.env.DEPLOY_ENV ?? 'local',
} as ConfigType<typeof deploymentConfig>;

const service = new BenchmarkService(perf, deployment);
const run = service.run();

const json = JSON.stringify(run, null, 2);
if (outPath !== undefined) {
  writeFileSync(outPath, `${json}\n`, 'utf8');
  process.stdout.write(`benchmark run written to ${outPath}\n`);
} else {
  process.stdout.write(`${json}\n`);
}
