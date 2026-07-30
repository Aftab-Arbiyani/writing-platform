/**
 * Benchmark regression gate (P7.3). Runs the deterministic benchmark catalogue
 * and compares mean timings to the committed `performance-baseline.json`. Fails
 * (exit 1) if any scenario regresses beyond the allowed tolerance — a CI-runnable
 * "performance regression test". Because the benchmarks are pure + deterministic,
 * the only thing that moves the numbers is a real change in the measured code.
 *
 *   pnpm --filter backend exec ts-node -r tsconfig-paths/register perf/check-regression.ts [--tolerance 0.5] [--update]
 *
 * `--update` rewrites the baseline (do this deliberately when a change is known
 * to shift timings, and review the diff).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ConfigType } from '@nestjs/config';

import type { deploymentConfig } from '../src/config/deployment.config';
import type { performanceConfig } from '../src/config/performance.config';
import { BenchmarkService } from '../src/modules/performance/benchmark/benchmark.service';
import type { BenchmarkRun } from '../src/modules/performance/performance.types';

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const BASELINE_PATH = join(__dirname, 'performance-baseline.json');
// Default tolerance is generous (50%) because micro-benchmark wall-clock varies
// with the host; the gate exists to catch ORDER-OF-MAGNITUDE regressions, not
// noise. Tighten on dedicated CI hardware.
const tolerance = Number(arg('--tolerance') ?? 0.5);
const update = process.argv.includes('--update');

const perf = { benchmarkEnabled: true, benchmarkIterations: 2000 } as ConfigType<
  typeof performanceConfig
>;
const deployment = { environment: 'ci' } as ConfigType<typeof deploymentConfig>;

const run = new BenchmarkService(perf, deployment).run();

if (update) {
  writeFileSync(BASELINE_PATH, `${JSON.stringify(run, null, 2)}\n`, 'utf8');
  process.stdout.write(`baseline updated (${run.results.length} scenarios)\n`);
  process.exit(0);
}

let baseline: BenchmarkRun;
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as BenchmarkRun;
} catch {
  process.stderr.write('no baseline found — run with --update first\n');
  process.exit(1);
}

const baseByScenario = new Map(baseline.results.map((r) => [r.scenario, r]));
const regressions: string[] = [];

for (const result of run.results) {
  const base = baseByScenario.get(result.scenario);
  if (base === undefined) {
    continue;
  }
  // Guard against a near-zero baseline (division blow-up on sub-microsecond ops).
  const floor = Math.max(base.meanMs, 0.001);
  const delta = (result.meanMs - floor) / floor;
  const verdict = delta > tolerance ? 'REGRESSION' : 'ok';
  process.stdout.write(
    `${verdict.padEnd(11)} ${result.scenario.padEnd(28)} base=${base.meanMs}ms now=${result.meanMs}ms (${(delta * 100).toFixed(1)}%)\n`,
  );
  if (delta > tolerance) {
    regressions.push(
      `${result.scenario}: ${base.meanMs}ms → ${result.meanMs}ms (+${(delta * 100).toFixed(1)}%)`,
    );
  }
}

if (regressions.length > 0) {
  process.stderr.write(
    `\n${regressions.length} performance regression(s) beyond ${tolerance * 100}%:\n`,
  );
  for (const r of regressions) {
    process.stderr.write(`  - ${r}\n`);
  }
  process.exit(1);
}

process.stdout.write('\nno benchmark regressions.\n');
process.exit(0);
