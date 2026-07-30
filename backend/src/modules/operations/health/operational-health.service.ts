import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { RedisService } from '../../../redis/redis.service';
import { QueueMonitorService } from '../../../infrastructure/monitoring/queue-monitor.service';
import { PerformanceVerificationService } from '../../performance/verification/performance-verification.service';
import { AlertingService } from '../alerting/alerting.service';
import { IncidentService } from '../incidents/incident.service';
import { ALERT_CATEGORY, ALERT_SEVERITY } from '../operations.constants';
import type {
  AlertEvaluation,
  ComponentHealth,
  OperationalHealthReport,
} from '../operations.types';
import { nowIso } from '../operations.util';

/**
 * Operational Health Service (P7.4) — the operational (higher-order) health view,
 * COMPOSED from platforms that already measure health, never a parallel checker:
 * per-dependency reachability from the real DB/Redis clients, worker/background
 * health from the queue monitor, runtime/performance health from the P7.3
 * verification verdict, and per-service health overlaid from the firing alerts.
 *
 * The RAW per-dependency probes remain the Health module's job (`/health/deep`);
 * this is the operational summary an on-call reads. It stays cycle-free (it does
 * NOT import HealthModule) so the ops health INDICATOR can be wired into the
 * health controller the same way the performance indicator is.
 */
@Injectable()
export class OperationalHealthService {
  private readonly logger = new Logger(OperationalHealthService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redis: RedisService,
    private readonly queues: QueueMonitorService,
    private readonly performance: PerformanceVerificationService,
    private readonly alerting: AlertingService,
    private readonly incidents: IncidentService,
  ) {}

  /** Build the operational-health report. */
  async report(): Promise<OperationalHealthReport> {
    const [database, redis, workers, alerts, openIncidents] = await Promise.all([
      this.pingDatabase(),
      this.pingRedis(),
      this.workerHealth(),
      this.safeAlerts(),
      this.incidents.listOpen(),
    ]);

    const runtime = this.runtimeHealth();
    const firing = alerts.filter((a) => a.firing && !a.suppressed);

    const components: ComponentHealth[] = [
      runtime,
      database,
      redis,
      ...workers,
      this.serviceHealth('api', ALERT_CATEGORY.Availability, firing),
      this.serviceHealth('ai', ALERT_CATEGORY.AiProvider, firing, 'third_party'),
      this.serviceHealth('search', ALERT_CATEGORY.Search, firing),
      this.serviceHealth('payments', ALERT_CATEGORY.Payment, firing, 'third_party'),
      this.serviceHealth('security', ALERT_CATEGORY.Security, firing),
    ];

    const overall = this.grade(components);
    const hardDown = components.some(
      (c) => (c.name === 'database' || c.name === 'redis') && c.status === 'down',
    );
    const criticalFiring = firing.some((a) => a.severity === ALERT_SEVERITY.Critical);
    const ready = !hardDown && overall !== 'unhealthy';

    return {
      generatedAt: nowIso(),
      overall,
      ready,
      components,
      statusSummary: this.summary(
        overall,
        components,
        firing.length,
        openIncidents.length,
        criticalFiring,
      ),
    };
  }

  /** Compact readiness verdict for the ops health indicator (`/health/operations`). */
  async readiness(): Promise<{ ready: boolean; overall: OperationalHealthReport['overall'] }> {
    const report = await this.report();
    return { ready: report.ready, overall: report.overall };
  }

  // ── Component probes (reuse the real clients / platforms) ───────────────────

  private async pingDatabase(): Promise<ComponentHealth> {
    try {
      await this.dataSource.query('SELECT 1');
      return { name: 'database', category: 'dependency', status: 'healthy', detail: 'reachable' };
    } catch (error) {
      return {
        name: 'database',
        category: 'dependency',
        status: 'down',
        detail: (error as Error).message,
      };
    }
  }

  private async pingRedis(): Promise<ComponentHealth> {
    try {
      const pong = await this.redis.getClient('cache').ping();
      return {
        name: 'redis',
        category: 'dependency',
        status: pong === 'PONG' ? 'healthy' : 'degraded',
        detail: pong === 'PONG' ? 'reachable' : `unexpected reply: ${pong}`,
      };
    } catch (error) {
      return {
        name: 'redis',
        category: 'dependency',
        status: 'down',
        detail: (error as Error).message,
      };
    }
  }

  private async workerHealth(): Promise<ComponentHealth[]> {
    try {
      const queues = await this.queues.listQueues();
      const totalWorkers = queues.reduce((s, q) => s + q.workers, 0);
      const oldestSeconds = Math.max(
        0,
        ...queues.map((q) => Math.round(q.oldestWaitingAgeMs / 1000)),
      );
      return [
        {
          name: 'workers',
          category: 'worker',
          status: totalWorkers > 0 ? 'healthy' : 'degraded',
          detail: `${totalWorkers} workers across ${queues.length} queues`,
        },
        {
          name: 'background-tasks',
          category: 'worker',
          status: oldestSeconds > 60 ? 'degraded' : 'healthy',
          detail: `oldest waiting job ${oldestSeconds}s`,
        },
      ];
    } catch (error) {
      this.logger.warn(`worker health unavailable: ${(error as Error).message}`);
      return [
        {
          name: 'workers',
          category: 'worker',
          status: 'unknown',
          detail: 'queue monitor unavailable',
        },
      ];
    }
  }

  private runtimeHealth(): ComponentHealth {
    const outcome = this.performance.verify();
    return {
      name: 'runtime',
      category: 'infrastructure',
      status: outcome.ok ? 'healthy' : outcome.failed <= 2 ? 'degraded' : 'down',
      detail: outcome.ok
        ? 'all performance budgets within target'
        : `${outcome.failed} performance budget(s) violated`,
    };
  }

  private serviceHealth(
    name: string,
    category: (typeof ALERT_CATEGORY)[keyof typeof ALERT_CATEGORY],
    firing: readonly AlertEvaluation[],
    componentCategory: ComponentHealth['category'] = 'service',
  ): ComponentHealth {
    const relevant = firing.filter((a) => a.category === category);
    if (relevant.length === 0) {
      return { name, category: componentCategory, status: 'healthy', detail: 'no alerts firing' };
    }
    const critical = relevant.some((a) => a.severity === ALERT_SEVERITY.Critical);
    return {
      name,
      category: componentCategory,
      status: critical ? 'down' : 'degraded',
      detail: `${relevant.length} alert(s) firing: ${relevant.map((a) => a.id).join(', ')}`,
    };
  }

  private async safeAlerts(): Promise<readonly AlertEvaluation[]> {
    try {
      return (await this.alerting.evaluate()).evaluations;
    } catch (error) {
      this.logger.warn(`alert evaluation unavailable for health: ${(error as Error).message}`);
      return [];
    }
  }

  private grade(components: readonly ComponentHealth[]): OperationalHealthReport['overall'] {
    if (components.some((c) => c.status === 'down')) {
      return 'unhealthy';
    }
    if (components.some((c) => c.status === 'degraded')) {
      return 'degraded';
    }
    return 'healthy';
  }

  private summary(
    overall: OperationalHealthReport['overall'],
    components: readonly ComponentHealth[],
    firing: number,
    openIncidents: number,
    criticalFiring: boolean,
  ): string {
    const healthy = components.filter((c) => c.status === 'healthy').length;
    const lead =
      overall === 'healthy'
        ? 'Platform healthy'
        : overall === 'degraded'
          ? 'Platform degraded'
          : 'Platform unhealthy';
    const crit = criticalFiring ? ' (critical alert firing)' : '';
    return `${lead}${crit} — ${healthy}/${components.length} components healthy, ${openIncidents} open incident(s), ${firing} alert(s) firing.`;
  }
}
