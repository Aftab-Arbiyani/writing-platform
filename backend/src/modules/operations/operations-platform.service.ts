import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { CacheService } from '../../infrastructure/cache/cache.service';
import { operationsConfig } from '../../config/operations.config';
import { ObservabilityService } from './observability/observability.service';
import { SloService } from './slo/slo.service';
import { AlertingService } from './alerting/alerting.service';
import { IncidentService } from './incidents/incident.service';
import { DeploymentObservabilityService } from './deployment/deployment-observability.service';
import { CostObservabilityService } from './cost/cost-observability.service';
import { ReliabilityService } from './reliability/reliability.service';
import { OperationalHealthService } from './health/operational-health.service';
import { OperationalGovernanceService } from './governance/operational-governance.service';
import { OPS_REDIS, OPS_SNAPSHOT_TTL_SECONDS } from './operations.constants';
import { nowIso } from './operations.util';
import type {
  AlertReport,
  CostReport,
  DeploymentReport,
  ObservabilityPosture,
  OperationalHealthReport,
  ReliabilityReport,
  SloReport,
} from './operations.types';

/** Non-secret posture snapshot for the admin Operations dashboard. */
export interface OperationsPlatformStatus {
  readonly generatedAt: string;
  readonly health: 'healthy' | 'degraded' | 'unhealthy';
  readonly ready: boolean;
  readonly slo: { total: number; meeting: number; atRisk: number; breaching: number };
  readonly alerts: { firing: number; suppressed: number };
  readonly incidents: { open: number };
  readonly deployment: { version: string; successRate: number; rollbacks: number };
  readonly reliability: { availabilityRatio: number; mttrMinutes: number | null };
  readonly costDailyUsd: number;
  readonly centralized: boolean;
  /** The cross-cutting controls the platform provides (audit/report language). */
  readonly controls: readonly string[];
}

/** The full operations report (persisted snapshot). */
export interface OperationsReport {
  readonly generatedAt: string;
  readonly status: OperationsPlatformStatus;
  readonly observability: ObservabilityPosture;
  readonly slo: SloReport;
  readonly alerts: AlertReport;
  readonly health: OperationalHealthReport;
  readonly deployment: DeploymentReport;
  readonly cost: CostReport;
  readonly reliability: ReliabilityReport;
}

/**
 * Operations Platform facade (P7.4) — the single injectable through which the
 * platform's capabilities are reached, and the SINGLE SOURCE OF TRUTH for
 * operating the platform in production. It ORCHESTRATES the observability, SLO,
 * alerting, incident, deployment, cost, reliability, health, and governance
 * services behind one surface + a posture snapshot; it never re-implements any of
 * them, and business services carry no operational logic — they emit signals and
 * the platform owns evaluation, alerting, incidents, and reporting centrally.
 */
@Injectable()
export class OperationsPlatformService {
  private readonly logger = new Logger(OperationsPlatformService.name);

  constructor(
    readonly observability: ObservabilityService,
    readonly slo: SloService,
    readonly alerting: AlertingService,
    readonly incidents: IncidentService,
    readonly deployment: DeploymentObservabilityService,
    readonly cost: CostObservabilityService,
    readonly reliability: ReliabilityService,
    readonly operationalHealth: OperationalHealthService,
    readonly governance: OperationalGovernanceService,
    private readonly cache: CacheService,
    @Inject(operationsConfig.KEY)
    private readonly config: ConfigType<typeof operationsConfig>,
  ) {}

  /** Posture snapshot — safe for admins (no secrets, aggregate signals only). */
  async status(): Promise<OperationsPlatformStatus> {
    const [slo, alerts, health, deployment, reliability, openIncidents, costDailyUsd] =
      await Promise.all([
        this.slo.report(),
        this.alerting.evaluate(),
        this.operationalHealth.report(),
        this.deployment.report(),
        this.reliability.report(),
        this.incidents.listOpen(),
        this.cost.dailyUsd(),
      ]);
    const governance = this.governance.report();

    return {
      generatedAt: nowIso(),
      health: health.overall,
      ready: health.ready,
      slo: {
        total: slo.objectives.length,
        meeting: slo.meeting,
        atRisk: slo.atRisk,
        breaching: slo.breaching,
      },
      alerts: { firing: alerts.firing, suppressed: alerts.suppressed },
      incidents: { open: openIncidents.length },
      deployment: {
        version: deployment.current.version,
        successRate: deployment.successRate,
        rollbacks: deployment.rollbacks,
      },
      reliability: {
        availabilityRatio: reliability.availabilityRatio,
        mttrMinutes: reliability.mttrMinutes,
      },
      costDailyUsd,
      centralized: governance.centralized,
      controls: [
        'centralized-observability',
        'structured-logging',
        'metrics-exposition',
        'distributed-tracing',
        'slo-error-budgets',
        'burn-rate-monitoring',
        'centralized-alerting',
        'alert-dedup-suppression-routing',
        'incident-management',
        'operational-health',
        'deployment-observability',
        'cost-observability',
        'feature-rollout-kill-switch',
        'reliability-mttr-mtbf',
        'runbooks',
        'operational-governance',
        'chaos-readiness',
      ],
    };
  }

  /** Build the full operations report (and persist the snapshot, best-effort). */
  async report(): Promise<OperationsReport> {
    const [status, slo, alerts, health, deployment, cost, reliability] = await Promise.all([
      this.status(),
      this.slo.report(),
      this.alerting.evaluate(),
      this.operationalHealth.report(),
      this.deployment.report(),
      this.cost.estimate(),
      this.reliability.report(),
    ]);

    const report: OperationsReport = {
      generatedAt: nowIso(),
      status,
      observability: this.observability.posture(),
      slo,
      alerts,
      health,
      deployment,
      cost,
      reliability,
    };

    await this.persist(report);
    return report;
  }

  /** The last persisted operations report snapshot, if any. */
  lastSnapshot(): Promise<OperationsReport | null> {
    return this.cache.get<OperationsReport>(OPS_REDIS.reportSnapshot);
  }

  private async persist(report: OperationsReport): Promise<void> {
    if (!this.config.enabled) {
      return;
    }
    try {
      await this.cache.set(OPS_REDIS.reportSnapshot, report, OPS_SNAPSHOT_TTL_SECONDS);
    } catch (error) {
      this.logger.warn(`operations report snapshot persist failed: ${(error as Error).message}`);
    }
  }
}
