import type { DataSource } from 'typeorm';

import type { RedisService } from '../../../redis/redis.service';
import type { QueueMonitorService } from '../../../infrastructure/monitoring/queue-monitor.service';
import type { PerformanceVerificationService } from '../../performance/verification/performance-verification.service';
import type { AlertingService } from '../alerting/alerting.service';
import type { IncidentService } from '../incidents/incident.service';
import { ALERT_CATEGORY, ALERT_SEVERITY, type AlertSeverity } from '../operations.constants';
import type { AlertEvaluation } from '../operations.types';
import { OperationalHealthService } from './operational-health.service';

function build(opts: {
  dbOk?: boolean;
  redisOk?: boolean;
  workers?: number;
  perfOk?: boolean;
  alerts?: AlertEvaluation[];
}): OperationalHealthService {
  const dataSource = {
    query: jest.fn(() =>
      opts.dbOk === false ? Promise.reject(new Error('down')) : Promise.resolve([{ '?': 1 }]),
    ),
  } as unknown as DataSource;
  const redis = {
    getClient: () => ({ ping: () => Promise.resolve(opts.redisOk === false ? 'NOPE' : 'PONG') }),
  } as unknown as RedisService;
  const queues = {
    listQueues: () =>
      Promise.resolve([
        {
          name: 'q',
          counts: {},
          paused: false,
          oldestWaitingAgeMs: 1000,
          workers: opts.workers ?? 2,
        },
      ]),
  } as unknown as QueueMonitorService;
  const performance = {
    verify: () => ({
      ok: opts.perfOk !== false,
      passed: 1,
      failed: opts.perfOk === false ? 3 : 0,
      notMeasured: 0,
      violations: [],
    }),
  } as unknown as PerformanceVerificationService;
  const alerting = {
    evaluate: () =>
      Promise.resolve({
        generatedAt: '',
        firing: 0,
        suppressed: 0,
        evaluations: opts.alerts ?? [],
      }),
  } as unknown as AlertingService;
  const incidents = { listOpen: () => Promise.resolve([]) } as unknown as IncidentService;
  return new OperationalHealthService(dataSource, redis, queues, performance, alerting, incidents);
}

function firingAlert(
  category: (typeof ALERT_CATEGORY)[keyof typeof ALERT_CATEGORY],
  severity: AlertSeverity = ALERT_SEVERITY.Critical,
): AlertEvaluation {
  return {
    id: `alert.${category}`,
    label: 'x',
    category,
    severity,
    metric: 'm',
    threshold: 1,
    unit: 'count',
    measured: 2,
    firing: true,
    runbookId: 'r',
    route: 'oncall-primary',
    suppressed: false,
    suppressedReason: null,
  };
}

describe('OperationalHealthService', () => {
  it('reports healthy when everything is up', async () => {
    const report = await build({}).report();
    expect(report.overall).toBe('healthy');
    expect(report.ready).toBe(true);
    expect(report.statusSummary).toContain('healthy');
  });

  it('is unhealthy + not ready when the database is down', async () => {
    const report = await build({ dbOk: false }).report();
    expect(report.components.find((c) => c.name === 'database')?.status).toBe('down');
    expect(report.overall).toBe('unhealthy');
    expect(report.ready).toBe(false);
  });

  it('degrades a service when an availability alert of warning severity fires', async () => {
    const report = await build({
      alerts: [firingAlert(ALERT_CATEGORY.Availability, ALERT_SEVERITY.Warning)],
    }).report();
    expect(report.components.find((c) => c.name === 'api')?.status).toBe('degraded');
    expect(report.overall).toBe('degraded');
  });

  it('marks a service down on a firing critical alert', async () => {
    const report = await build({ alerts: [firingAlert(ALERT_CATEGORY.AiProvider)] }).report();
    expect(report.components.find((c) => c.name === 'ai')?.status).toBe('down');
  });

  it('degrades workers when none are connected', async () => {
    const report = await build({ workers: 0 }).report();
    expect(report.components.find((c) => c.name === 'workers')?.status).toBe('degraded');
  });

  it('exposes a compact readiness verdict', async () => {
    const readiness = await build({}).readiness();
    expect(readiness).toEqual({ ready: true, overall: 'healthy' });
  });
});
