import { Global, Module } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import {
  registerOperationsObserver,
  OPERATIONS_OBSERVER,
} from '../../common/operations/operations-observer.port';
import { registerTracer, TRACER } from '../../common/operations/tracing.port';
import { AuditModule } from '../audit/audit.module';
import { SettingsModule } from '../settings/settings.module';

import { OperationsRegistryService } from './collector/operations-registry.service';
import { SignalCollectorService } from './collector/signal-collector.service';
import { OperationsTracerService } from './tracing/operations-tracer.service';
import { TracingService } from './tracing/tracing.service';
import { LoggingService } from './logging/logging.service';
import { MetricsFacadeService } from './metrics/metrics-facade.service';
import { ObservabilityService } from './observability/observability.service';
import { SloService } from './slo/slo.service';
import { AlertingService } from './alerting/alerting.service';
import { IncidentStore } from './incidents/incident-store';
import { IncidentService } from './incidents/incident.service';
import { DeploymentObservabilityService } from './deployment/deployment-observability.service';
import { CostObservabilityService } from './cost/cost-observability.service';
import { ReliabilityService } from './reliability/reliability.service';
import { OperationalHealthService } from './health/operational-health.service';
import { FeatureRolloutService } from './rollout/feature-rollout.service';
import { RunbookService } from './runbook/runbook.service';
import { OperationalGovernanceService } from './governance/operational-governance.service';
import { DashboardService } from './dashboards/dashboard.service';
import { ChaosService } from './chaos/chaos.service';
import { OperationsPlatformService } from './operations-platform.service';
import { OperationsHealthIndicator } from './operations-health.indicator';
import { OperationsAdminController } from './operations-admin.controller';

/**
 * The Operations Platform (P7.4) — the SINGLE SOURCE OF TRUTH for operating the
 * platform in production: observability (metrics/logs/traces), SLOs + error
 * budgets, alerting, incident management, operational health, deployment + cost
 * observability, feature rollout, reliability, runbooks, and governance.
 *
 * `@Global` so its facade + health indicator are injectable anywhere (the health
 * probe reads them) without re-importing. Imported LAST in `app.module` so it
 * composes the whole backbone it reads: the P7.3 Performance Platform (SLO/alert
 * signals + capacity), the P7.2 Security counters, the P7.1 config/health/
 * deployment platform, the Settings feature-flag subsystem (rollout), the audit
 * trail (incident/deployment history), and the shared /metrics + CacheService +
 * QueueMonitor. Business services carry NO operational logic — they emit signals
 * through the single OperationsObserver + Tracer seams and the platform owns
 * evaluation, alerting, incidents, and reporting centrally. Nothing here is on a
 * request's critical path.
 */
@Global()
@Module({
  imports: [TerminusModule, AuditModule, SettingsModule],
  controllers: [OperationsAdminController],
  providers: [
    OperationsRegistryService,
    { provide: OPERATIONS_OBSERVER, useExisting: OperationsRegistryService },
    OperationsTracerService,
    { provide: TRACER, useExisting: OperationsTracerService },
    SignalCollectorService,
    TracingService,
    LoggingService,
    MetricsFacadeService,
    ObservabilityService,
    SloService,
    AlertingService,
    IncidentStore,
    IncidentService,
    DeploymentObservabilityService,
    CostObservabilityService,
    ReliabilityService,
    OperationalHealthService,
    FeatureRolloutService,
    RunbookService,
    OperationalGovernanceService,
    DashboardService,
    ChaosService,
    OperationsPlatformService,
    OperationsHealthIndicator,
  ],
  exports: [
    OperationsPlatformService,
    OperationsHealthIndicator,
    FeatureRolloutService,
    OPERATIONS_OBSERVER,
    TRACER,
  ],
})
export class OperationsModule implements OnModuleInit {
  constructor(
    private readonly registry: OperationsRegistryService,
    private readonly tracer: OperationsTracerService,
  ) {}

  /** Wire the DI-less observer + tracer accessors so any non-DI code feeds the
   * same singletons the DI tokens resolve to (mirrors the P7.3 observer wiring). */
  onModuleInit(): void {
    registerOperationsObserver(this.registry);
    registerTracer(this.tracer);
  }
}
