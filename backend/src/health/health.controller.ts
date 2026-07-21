import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import type { HealthCheckResult } from '@nestjs/terminus';

import { QueueHealthIndicator } from '../infrastructure/queue/queue-health.indicator';
import { PerformanceHealthIndicator } from '../modules/performance/performance-health.indicator';
import { Public } from '../modules/auth/decorators/public.decorator';
import { AiHealthIndicator } from './indicators/ai.health-indicator';
import { ConfigHealthIndicator } from './indicators/config.health-indicator';
import { PaymentHealthIndicator } from './indicators/payment.health-indicator';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';
import { SearchHealthIndicator } from './indicators/search.health-indicator';
import { StorageHealthIndicator } from './indicators/storage.health-indicator';

/**
 * Probe endpoints for orchestrators (docs 14 §3). Mounted at the ROOT
 * (`/health/*`, version-neutral, excluded from the `/api` prefix in `main.ts`)
 * so infra can probe without knowing the API version, and all are `@Public` +
 * exempt from rate limiting.
 *
 * - **Liveness** (`GET /health`, alias `GET /health/live`): "is the process up?"
 *   — no dependency checks, so a dependency blip never triggers a pod restart.
 * - **Readiness** (`GET /health/ready`): "can it serve traffic?" — Postgres +
 *   Redis + queues. Storage is deliberately NOT in this hard gate: it is
 *   degraded-not-dead (reads still work if only storage is down, docs 14 §3), so
 *   a storage blip must not pull the instance out of rotation.
 * - **Per-dependency** (`/health/database`, `/redis`, `/storage`, `/queues`): a
 *   targeted probe each, for dashboards and on-call triage.
 */
@ApiTags('health')
@Public()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly queues: QueueHealthIndicator,
    private readonly storage: StorageHealthIndicator,
    private readonly configHealth: ConfigHealthIndicator,
    private readonly ai: AiHealthIndicator,
    private readonly payments: PaymentHealthIndicator,
    private readonly search: SearchHealthIndicator,
    private readonly performance: PerformanceHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness — is the process alive? No dependency checks.' })
  @ApiOkResponse({ description: 'Process is alive.' })
  liveness(): Promise<HealthCheckResult> {
    return this.health.check([]);
  }

  @Get('live')
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness alias (Kubernetes livenessProbe convention).' })
  @ApiOkResponse({ description: 'Process is alive.' })
  live(): Promise<HealthCheckResult> {
    return this.health.check([]);
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness — Postgres + Redis + queues reachable.' })
  @ApiOkResponse({ description: 'Process is ready to serve traffic.' })
  @ApiServiceUnavailableResponse({
    description: 'A hard dependency (Postgres/Redis/queues) is down.',
  })
  readiness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.isHealthy('redis'),
      () => this.queues.isHealthy('queues'),
    ]);
  }

  @Get('startup')
  @HealthCheck()
  @ApiOperation({
    summary: 'Startup — boot-critical deps + config valid (Kubernetes startupProbe).',
  })
  @ApiOkResponse({ description: 'Process has finished initializing.' })
  @ApiServiceUnavailableResponse({ description: 'Still starting / boot-critical dep down.' })
  startup(): Promise<HealthCheckResult> {
    // Gates the slow-boot window: DB + Redis reachable and config valid. Queues
    // and storage are intentionally excluded (they self-heal after start-up).
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.isHealthy('redis'),
      () => this.configHealth.isHealthy('config'),
    ]);
  }

  @Get('deep')
  @HealthCheck()
  @ApiOperation({
    summary: 'Deep aggregate — every dependency + subsystem. For dashboards/triage, NOT probes.',
  })
  @ApiOkResponse({ description: 'Full dependency snapshot.' })
  @ApiServiceUnavailableResponse({ description: 'One or more hard dependencies is down.' })
  deep(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.isHealthy('redis'),
      () => this.queues.isHealthy('queues'),
      () => this.storage.isHealthy('storage'),
      () => this.configHealth.isHealthy('config'),
      () => this.search.isHealthy('search'),
      () => this.ai.isHealthy('ai'),
      () => this.payments.isHealthy('payments'),
      () => this.performance.isHealthy('performance'),
    ]);
  }

  @Get('database')
  @HealthCheck()
  @ApiOperation({ summary: 'Postgres connectivity (SELECT 1).' })
  @ApiOkResponse({ description: 'Database reachable.' })
  @ApiServiceUnavailableResponse({ description: 'Database unreachable.' })
  database(): Promise<HealthCheckResult> {
    return this.health.check([() => this.db.pingCheck('database')]);
  }

  @Get('redis')
  @HealthCheck()
  @ApiOperation({ summary: 'Redis connectivity (PING, DB 0).' })
  @ApiOkResponse({ description: 'Redis reachable.' })
  @ApiServiceUnavailableResponse({ description: 'Redis unreachable.' })
  redisHealth(): Promise<HealthCheckResult> {
    return this.health.check([() => this.redis.isHealthy('redis')]);
  }

  @Get('storage')
  @HealthCheck()
  @ApiOperation({ summary: 'Object-storage connectivity (HEAD media bucket).' })
  @ApiOkResponse({ description: 'Storage reachable.' })
  @ApiServiceUnavailableResponse({
    description: 'Storage unreachable (degraded — reads still work).',
  })
  storageHealth(): Promise<HealthCheckResult> {
    return this.health.check([() => this.storage.isHealthy('storage')]);
  }

  @Get('queues')
  @HealthCheck()
  @ApiOperation({ summary: 'BullMQ queue connectivity + per-queue depth snapshot.' })
  @ApiOkResponse({ description: 'Queues reachable.' })
  @ApiServiceUnavailableResponse({ description: 'Queue Redis unreachable.' })
  queuesHealth(): Promise<HealthCheckResult> {
    return this.health.check([() => this.queues.isHealthy('queues')]);
  }

  @Get('config')
  @HealthCheck()
  @ApiOperation({ summary: 'Configuration & secret health (presence/validity, never values).' })
  @ApiOkResponse({ description: 'Config valid for this environment.' })
  @ApiServiceUnavailableResponse({ description: 'A required secret is missing/invalid.' })
  configHealthCheck(): Promise<HealthCheckResult> {
    return this.health.check([() => this.configHealth.isHealthy('config')]);
  }

  @Get('search')
  @HealthCheck()
  @ApiOperation({ summary: 'Search (Postgres full-text path) functional.' })
  @ApiOkResponse({ description: 'Search FTS reachable.' })
  @ApiServiceUnavailableResponse({ description: 'Search FTS check failed.' })
  searchHealth(): Promise<HealthCheckResult> {
    return this.health.check([() => this.search.isHealthy('search')]);
  }

  @Get('ai')
  @HealthCheck()
  @ApiOperation({ summary: 'AI provider readiness (configured/inert — no live call).' })
  @ApiOkResponse({ description: 'AI provider status reported.' })
  aiHealth(): Promise<HealthCheckResult> {
    return this.health.check([() => this.ai.isHealthy('ai')]);
  }

  @Get('payments')
  @HealthCheck()
  @ApiOperation({ summary: 'Payment provider readiness (configured/inert — no live call).' })
  @ApiOkResponse({ description: 'Payment provider status reported.' })
  paymentsHealth(): Promise<HealthCheckResult> {
    return this.health.check([() => this.payments.isHealthy('payments')]);
  }

  @Get('performance')
  @HealthCheck()
  @ApiOperation({
    summary: 'Performance health (P7.3) — up while no server-measured budget is violated.',
  })
  @ApiOkResponse({ description: 'All measured performance budgets within target.' })
  @ApiServiceUnavailableResponse({
    description: 'A performance budget is violated (degradation signal; NOT a readiness failure).',
  })
  performanceHealth(): Promise<HealthCheckResult> {
    return this.health.check([() => this.performance.isHealthy('performance')]);
  }
}
