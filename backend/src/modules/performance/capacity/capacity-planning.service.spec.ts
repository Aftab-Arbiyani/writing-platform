import type { ConfigType } from '@nestjs/config';
import type { DataSource } from 'typeorm';

import type { databaseConfig } from '../../../config/database.config';
import type { performanceConfig } from '../../../config/performance.config';
import type { QueueMonitorService } from '../../../infrastructure/monitoring/queue-monitor.service';
import type { RedisService } from '../../../redis/redis.service';
import type { ThroughputAnalysisService } from '../analysis/throughput-analysis.service';
import { CapacityPlanningService } from './capacity-planning.service';

function build(opts?: { apiRps?: number; activeConns?: number; redisBytes?: number }) {
  const throughput = {
    analyze: jest.fn().mockReturnValue({
      byKind: { http: { count: 1, rps: opts?.apiRps ?? 10, errorRatePercent: 0 } },
    }),
  } as unknown as ThroughputAnalysisService;

  const queues = {
    listQueues: jest.fn().mockResolvedValue([
      {
        name: 'notifications',
        counts: { active: 2, waiting: 0, completed: 0, failed: 0, delayed: 0, paused: 0 },
      },
    ]),
  } as unknown as QueueMonitorService;

  const redis = {
    getClient: jest.fn().mockReturnValue({
      info: jest.fn().mockResolvedValue(`used_memory:${opts?.redisBytes ?? 100_000_000}\r\n`),
    }),
  } as unknown as RedisService;

  const dataSource = {
    query: jest.fn().mockResolvedValue([{ c: opts?.activeConns ?? 3 }]),
  } as unknown as DataSource;

  const db = {
    pool: { max: 10, min: 2, idleTimeoutMs: 30000, connectionTimeoutMs: 10000 },
  } as ConfigType<typeof databaseConfig>;
  const config = {
    capacity: { apiRps: 0, workers: 0, redisMemoryBytes: 0, aiTokensDaily: 0 },
  } as ConfigType<typeof performanceConfig>;

  return new CapacityPlanningService(throughput, queues, redis, dataSource, db, config);
}

describe('CapacityPlanningService', () => {
  it('produces a forecast for every capacity model', async () => {
    const plan = await build().plan();
    const resources = plan.forecasts.map((f) => f.resource);
    expect(resources).toEqual(
      expect.arrayContaining(['db.connections', 'workers', 'api.rps', 'redis.memory']),
    );
  });

  it('computes DB connection utilization from live active connections', async () => {
    const plan = await build({ activeConns: 8 }).plan();
    const db = plan.forecasts.find((f) => f.resource === 'db.connections');
    expect(db?.limit).toBe(10);
    expect(db?.used).toBe(8);
    expect(db?.utilizationPercent).toBe(80);
    expect(db?.shouldScale).toBe(true); // scaleAtPct 80
    expect(plan.scalingRecommendations.some((r) => r.includes('Database connections'))).toBe(true);
  });

  it('does not recommend scaling when utilization is below threshold', async () => {
    const plan = await build({ activeConns: 2 }).plan();
    const db = plan.forecasts.find((f) => f.resource === 'db.connections');
    expect(db?.shouldScale).toBe(false);
  });

  it('degrades to a model-only ceiling when a signal is unavailable', async () => {
    const throughput = {
      analyze: jest.fn().mockReturnValue({ byKind: {} }),
    } as unknown as ThroughputAnalysisService;
    const queues = {
      listQueues: jest.fn().mockRejectedValue(new Error('redis down')),
    } as unknown as QueueMonitorService;
    const redis = {
      getClient: jest
        .fn()
        .mockReturnValue({ info: jest.fn().mockRejectedValue(new Error('down')) }),
    } as unknown as RedisService;
    const dataSource = {
      query: jest.fn().mockRejectedValue(new Error('down')),
    } as unknown as DataSource;
    const db = {
      pool: { max: 10, min: 2, idleTimeoutMs: 1, connectionTimeoutMs: 1 },
    } as ConfigType<typeof databaseConfig>;
    const config = {
      capacity: { apiRps: 0, workers: 0, redisMemoryBytes: 0, aiTokensDaily: 0 },
    } as ConfigType<typeof performanceConfig>;
    const service = new CapacityPlanningService(throughput, queues, redis, dataSource, db, config);
    const plan = await service.plan();
    // No throw; every forecast present with used 0 where the signal failed.
    expect(plan.forecasts.length).toBeGreaterThan(0);
    expect(plan.forecasts.find((f) => f.resource === 'workers')?.used).toBe(0);
  });
});
