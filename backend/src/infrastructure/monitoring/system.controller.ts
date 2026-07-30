import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@qalam/shared';

import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { ConfigInspectorService } from '../../config/config-inspector.service';
import type { ConfigHealthReport } from '../../config/config-inspector.service';
import { deploymentConfig } from '../../config/deployment.config';
import { Permissions } from '../../modules/permissions/permissions.decorator';

/**
 * Operator system/deployment surface (P7.1). Feeds the admin "System" views:
 * Deployment Status, Environment Status, Build Information, Release Information,
 * Version Information, and Configuration Health. Read-only and admin-gated
 * (`admin.dashboard`); the global `JwtAuthGuard` authenticates, `@Permissions`
 * authorizes. Config-health reports secret *presence/validity* only — never a
 * secret value (ConfigInspectorService enforces this).
 */
@ApiTags('admin-system')
@ApiBearerAuth()
@Controller('admin/system')
@UseGuards(RateLimitGuard)
export class SystemController {
  constructor(
    @Inject(deploymentConfig.KEY)
    private readonly deployment: ConfigType<typeof deploymentConfig>,
    private readonly inspector: ConfigInspectorService,
  ) {}

  @Get('info')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({
    summary:
      'Full deployment/build/release/runtime identity of this instance. Requires `admin.dashboard`.',
  })
  @ApiOkResponse({ description: 'System information.' })
  info(): {
    service: string;
    environment: string;
    build: {
      version: string;
      commit: string;
      commitShort: string;
      buildTime: string;
      buildNumber: string;
    };
    release: { channel: string; releaseTag: string; deployedAt: string };
    runtime: {
      nodeVersion: string;
      pid: number;
      instanceId: string;
      startedAt: string;
      uptimeSeconds: number;
      workersEnabled: boolean;
      schedulerEnabled: boolean;
    };
    config: { version: string; fingerprint: string };
  } {
    return {
      service: this.deployment.serviceName,
      environment: this.deployment.environment,
      build: {
        version: this.deployment.version,
        commit: this.deployment.gitSha,
        commitShort: this.deployment.gitShaShort,
        buildTime: this.deployment.buildTime,
        buildNumber: this.deployment.buildNumber,
      },
      release: {
        channel: this.deployment.releaseChannel,
        releaseTag: this.deployment.releaseTag,
        deployedAt: this.deployment.deployedAt,
      },
      runtime: {
        nodeVersion: process.version,
        pid: process.pid,
        instanceId: this.deployment.instanceId,
        startedAt: this.deployment.startedAt,
        uptimeSeconds: Math.round(process.uptime()),
        workersEnabled: process.env.WORKERS_ENABLED !== 'false',
        schedulerEnabled: process.env.SCHEDULER_ENABLED !== 'false',
      },
      config: {
        version: this.deployment.configVersion,
        fingerprint: this.inspector.fingerprint(),
      },
    };
  }

  @Get('config-health')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({
    summary:
      'Configuration & secret health — presence/validity only, never values. Requires `admin.dashboard`.',
  })
  @ApiOkResponse({ description: 'Configuration health report.' })
  configHealth(): ConfigHealthReport {
    return this.inspector.report();
  }
}
