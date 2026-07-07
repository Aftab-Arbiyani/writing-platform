import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import type { HealthCheckResult } from '@nestjs/terminus';

import { RedisHealthIndicator } from './indicators/redis.health-indicator';

/**
 * Probe endpoints for orchestrators (docs 14). Mounted at the root
 * (`/health`, `/health/ready`) — version-neutral and excluded from the `/api`
 * prefix in `main.ts` — so infra can probe without knowing the API version.
 *
 * - Liveness (`/health`): "is the process up?" — no dependency checks, so a
 *   dependency blip never triggers a restart.
 * - Readiness (`/health/ready`): "can it serve traffic?" — pings Postgres and
 *   Redis; returns 503 (via Terminus) when a dependency is down, and the load
 *   balancer stops routing to this instance.
 */
@ApiTags('health')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOkResponse({ description: 'Process is alive.' })
  liveness(): Promise<HealthCheckResult> {
    return this.health.check([]);
  }

  @Get('ready')
  @HealthCheck()
  @ApiOkResponse({ description: 'Process is ready to serve traffic.' })
  @ApiServiceUnavailableResponse({ description: 'A dependency (Postgres/Redis) is down.' })
  readiness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.isHealthy('redis'),
    ]);
  }
}
