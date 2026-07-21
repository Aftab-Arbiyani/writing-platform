import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@qalam/shared';
import type { Request } from 'express';

import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Permissions } from '../permissions/permissions.decorator';
import { buildActor } from '../settings/settings.util';

import { OperationsPlatformService } from './operations-platform.service';
import type { OperationsPlatformStatus, OperationsReport } from './operations-platform.service';
import { MetricsFacadeService } from './metrics/metrics-facade.service';
import { TracingService } from './tracing/tracing.service';
import { FeatureRolloutService } from './rollout/feature-rollout.service';
import { RunbookService } from './runbook/runbook.service';
import { DashboardService } from './dashboards/dashboard.service';
import { ChaosService } from './chaos/chaos.service';
import { OperationsSummaryDto } from './dto/operations-response.dto';
import {
  AssignIncidentDto,
  IncidentNoteDto,
  OpenIncidentDto,
  OpenMaintenanceWindowDto,
  RecordDeploymentDto,
  ResolveIncidentDto,
  SetRolloutPercentageDto,
  TransitionIncidentDto,
} from './dto/operations-request.dto';

/**
 * Admin Operations surface (P7.4) — the read-only observability views + the
 * audited operational actions (incident lifecycle, feature rollout, maintenance
 * windows, deployment records) that back the admin Operations dashboards. Read
 * views are gated on `admin.dashboard`; mutations on `settings.manage` (the same
 * gate the feature-flag surface uses), and every mutation is audited by the
 * service it delegates to. The global JwtAuthGuard authenticates.
 */
@ApiTags('admin-operations')
@ApiBearerAuth()
@Controller('admin/operations')
@UseGuards(RateLimitGuard)
export class OperationsAdminController {
  constructor(
    private readonly platform: OperationsPlatformService,
    private readonly metrics: MetricsFacadeService,
    private readonly tracing: TracingService,
    private readonly rollout: FeatureRolloutService,
    private readonly runbooks: RunbookService,
    private readonly dashboards: DashboardService,
    private readonly chaos: ChaosService,
  ) {}

  // ── Overview ────────────────────────────────────────────────────────────

  @Get('summary')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({ summary: 'Operations Platform posture (health, SLO, alerts, incidents, cost).' })
  @ApiOkResponse({ type: OperationsSummaryDto })
  summary(): Promise<OperationsPlatformStatus> {
    return this.platform.status();
  }

  @Get('report')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({
    summary:
      'Full operations report (observability+SLO+alerts+health+deploy+cost+reliability); persists a snapshot.',
  })
  @ApiOkResponse({ description: 'OperationsReport.' })
  report(): Promise<OperationsReport> {
    return this.platform.report();
  }

  @Get('governance')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({
    summary: 'Operational governance — centralization + telemetry-consistency checks.',
  })
  @ApiOkResponse({ description: 'GovernanceReport.' })
  governance() {
    return this.platform.governance.report();
  }

  @Get('dashboards')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({ summary: 'The operational dashboard catalogue (the 15 views + their sources).' })
  dashboardCatalog() {
    return this.dashboards.list();
  }

  // ── Observability trio ────────────────────────────────────────────────────

  @Get('observability')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({ summary: 'Observability posture (metrics + logs + traces).' })
  observability() {
    return this.platform.observability.posture();
  }

  @Get('metrics')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({
    summary: 'Structured operational metrics snapshot (from the shared /metrics signals).',
  })
  metricsSnapshot() {
    return this.metrics.snapshot();
  }

  @Get('traces')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({ summary: 'Recent distributed traces (bounded in-memory read model).' })
  traces() {
    return this.tracing.recent();
  }

  @Get('traces/:traceId')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({ summary: 'One trace by id (its spans).' })
  trace(@Param('traceId') traceId: string) {
    const trace = this.tracing.get(traceId);
    if (trace === null) {
      throw new NotFoundException('trace not found or evicted');
    }
    return trace;
  }

  // ── SLO / alerts ───────────────────────────────────────────────────────────

  @Get('slo')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({ summary: 'SLO report — SLIs, error budgets, burn rate per objective.' })
  slo() {
    return this.platform.slo.report();
  }

  @Get('alerts')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({
    summary: 'Live alert evaluation (firing/suppressed, routed, with runbook links).',
  })
  alerts() {
    return this.platform.alerting.evaluate();
  }

  // ── Health / cost / reliability / deployment ─────────────────────────────

  @Get('health')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({ summary: 'Operational health — per-component + overall + readiness summary.' })
  health() {
    return this.platform.operationalHealth.report();
  }

  @Get('cost')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({ summary: 'Cost estimate by category + trend (internal estimate, not a bill).' })
  cost() {
    return this.platform.cost.estimate();
  }

  @Get('reliability')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({ summary: 'Reliability report — availability, MTTR, MTBF, failure classes.' })
  reliability() {
    return this.platform.reliability.report();
  }

  @Get('deployments')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({
    summary: 'Deployment observability — current build, success rate, rollbacks, history.',
  })
  deployments() {
    return this.platform.deployment.report();
  }

  @Post('deployments')
  @Permissions(PERMISSIONS.SettingsManage)
  @RateLimit('write')
  @ApiOperation({ summary: 'Record a deployment / rollback / migration / config / infra change.' })
  recordDeployment(@Body() dto: RecordDeploymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.platform.deployment.record(dto, user.id);
  }

  // ── Incidents ────────────────────────────────────────────────────────────

  @Get('incidents')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({ summary: 'All incidents, newest first.' })
  incidents() {
    return this.platform.incidents.list();
  }

  @Get('incidents/:id')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({ summary: 'One incident (with timeline).' })
  async incident(@Param('id') id: string) {
    const incident = await this.platform.incidents.get(id);
    if (incident === null) {
      throw new NotFoundException('incident not found');
    }
    return incident;
  }

  @Get('incidents/:id/postmortem')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({ summary: 'A postmortem template pre-filled from the incident.' })
  postmortem(@Param('id') id: string) {
    return this.platform.incidents.postmortem(id);
  }

  @Post('incidents')
  @Permissions(PERMISSIONS.SettingsManage)
  @RateLimit('write')
  @ApiOperation({ summary: 'Open an incident.' })
  openIncident(@Body() dto: OpenIncidentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.platform.incidents.open(dto, { id: user.id, role: user.role });
  }

  @Patch('incidents/:id/status')
  @Permissions(PERMISSIONS.SettingsManage)
  @RateLimit('write')
  @ApiOperation({ summary: 'Transition an incident status (validated against the lifecycle).' })
  transitionIncident(
    @Param('id') id: string,
    @Body() dto: TransitionIncidentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.platform.incidents.transition(id, dto.status, { id: user.id, role: user.role });
  }

  @Patch('incidents/:id/assignee')
  @Permissions(PERMISSIONS.SettingsManage)
  @RateLimit('write')
  @ApiOperation({ summary: 'Assign an incident to a user.' })
  assignIncident(
    @Param('id') id: string,
    @Body() dto: AssignIncidentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.platform.incidents.assign(id, dto.assigneeId, { id: user.id, role: user.role });
  }

  @Post('incidents/:id/notes')
  @Permissions(PERMISSIONS.SettingsManage)
  @RateLimit('write')
  @ApiOperation({ summary: 'Add a note to an incident timeline.' })
  noteIncident(
    @Param('id') id: string,
    @Body() dto: IncidentNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.platform.incidents.addNote(id, dto.message, { id: user.id, role: user.role });
  }

  @Post('incidents/:id/resolve')
  @Permissions(PERMISSIONS.SettingsManage)
  @RateLimit('write')
  @ApiOperation({ summary: 'Resolve an incident with a root cause + failure class.' })
  resolveIncident(
    @Param('id') id: string,
    @Body() dto: ResolveIncidentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.platform.incidents.resolve(id, dto, { id: user.id, role: user.role });
  }

  @Post('incidents/:id/verify-recovery')
  @Permissions(PERMISSIONS.SettingsManage)
  @RateLimit('write')
  @ApiOperation({ summary: 'Mark an incident recovery independently verified.' })
  verifyRecovery(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.platform.incidents.verifyRecovery(id, { id: user.id, role: user.role });
  }

  // ── Feature rollout ────────────────────────────────────────────────────────

  @Get('rollouts')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({ summary: 'All feature rollouts (projection over feature flags).' })
  rollouts() {
    return this.rollout.list();
  }

  @Get('rollouts/:key')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({ summary: 'One rollout state by key.' })
  rolloutState(@Param('key') key: string) {
    return this.rollout.get(key);
  }

  @Patch('rollouts/:key/percentage')
  @Permissions(PERMISSIONS.SettingsManage)
  @RateLimit('write')
  @ApiOperation({ summary: 'Set a rollout percentage (canary/percentage/full).' })
  setRolloutPercentage(
    @Param('key') key: string,
    @Body() dto: SetRolloutPercentageDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.rollout.setPercentage(key, dto.percentage, buildActor(user, req));
  }

  @Post('rollouts/:key/enable')
  @Permissions(PERMISSIONS.SettingsManage)
  @RateLimit('write')
  @ApiOperation({ summary: 'Fully enable a rollout (100%).' })
  enableRollout(
    @Param('key') key: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.rollout.enable(key, buildActor(user, req));
  }

  @Post('rollouts/:key/kill')
  @Permissions(PERMISSIONS.SettingsManage)
  @RateLimit('write')
  @ApiOperation({ summary: 'KILL SWITCH — emergency disable a feature everywhere at once.' })
  killRollout(
    @Param('key') key: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.rollout.killSwitch(key, buildActor(user, req));
  }

  // ── Runbooks / chaos ─────────────────────────────────────────────────────

  @Get('runbooks')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({ summary: 'The runbook collection.' })
  runbookList() {
    return this.runbooks.list();
  }

  @Get('runbooks/:id')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({ summary: 'One runbook by id.' })
  runbook(@Param('id') id: string) {
    const runbook = this.runbooks.get(id);
    if (runbook === null) {
      throw new NotFoundException('runbook not found');
    }
    return runbook;
  }

  @Get('chaos')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({ summary: 'Chaos-readiness catalogue (failure modes + built-in mitigations).' })
  chaosCatalog() {
    return this.chaos.list();
  }

  // ── Maintenance windows ────────────────────────────────────────────────────

  @Get('maintenance-windows')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({ summary: 'Active alert maintenance windows.' })
  maintenanceWindows() {
    return this.platform.alerting.activeMaintenanceWindows();
  }

  @Post('maintenance-windows')
  @Permissions(PERMISSIONS.SettingsManage)
  @RateLimit('write')
  @ApiOperation({ summary: 'Open an alert maintenance window (suppresses alerts).' })
  openMaintenanceWindow(@Body() dto: OpenMaintenanceWindowDto) {
    return this.platform.alerting.openMaintenanceWindow(dto);
  }

  @Delete('maintenance-windows/:id')
  @Permissions(PERMISSIONS.SettingsManage)
  @RateLimit('write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Close a maintenance window early.' })
  async closeMaintenanceWindow(@Param('id') id: string): Promise<void> {
    await this.platform.alerting.closeMaintenanceWindow(id);
  }
}
