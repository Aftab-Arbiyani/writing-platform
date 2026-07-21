import type { ConfigType } from '@nestjs/config';

import type { deploymentConfig } from '../../../config/deployment.config';
import type { performanceConfig } from '../../../config/performance.config';
import { BENCHMARK_SCENARIO } from '../performance.constants';
import { BenchmarkService } from './benchmark.service';

function build(iterations = 50) {
  const config = {
    benchmarkEnabled: true,
    benchmarkIterations: iterations,
  } as ConfigType<typeof performanceConfig>;
  const deployment = { environment: 'test' } as ConfigType<typeof deploymentConfig>;
  return new BenchmarkService(config, deployment);
}

describe('BenchmarkService', () => {
  it('lists the deterministic scenario catalogue', () => {
    const ids = build().scenarioIds();
    expect(ids).toContain(BENCHMARK_SCENARIO.CursorEncode);
    expect(ids).toContain(BENCHMARK_SCENARIO.LatencyPercentile);
  });

  it('runs every scenario and reports timing stats', () => {
    const run = build(30).run();
    expect(run.environment).toBe('test');
    expect(run.results.length).toBe(build().scenarioIds().length);
    for (const r of run.results) {
      expect(r.iterations).toBe(30);
      expect(r.meanMs).toBeGreaterThanOrEqual(0);
      expect(r.p95Ms).toBeGreaterThanOrEqual(r.p50Ms);
      expect(r.maxMs).toBeGreaterThanOrEqual(r.minMs);
      expect(r.opsPerSecond).toBeGreaterThanOrEqual(0);
    }
  });

  it('can run a filtered subset', () => {
    const run = build().run([BENCHMARK_SCENARIO.CursorEncode]);
    expect(run.results).toHaveLength(1);
    expect(run.results[0]!.scenario).toBe(BENCHMARK_SCENARIO.CursorEncode);
  });

  it('remembers the last run', () => {
    const service = build();
    expect(service.latest()).toBeNull();
    const run = service.run([BENCHMARK_SCENARIO.PromptRender]);
    expect(service.latest()).toEqual(run);
  });
});
