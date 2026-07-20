import { Controller, Get, Inject, VERSION_NEUTRAL } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { deploymentConfig } from '../../config/deployment.config';
import { Public } from '../../modules/auth/decorators/public.decorator';

/**
 * Public build/version endpoint (P7.1). Root-mounted (`/version`,
 * version-neutral, excluded from the `/api` prefix in main.ts) and `@Public`,
 * mirroring `/health` and `/metrics`, so a deploy smoke test or an uptime probe
 * can confirm "which build is live" with no auth and no version prefix.
 *
 * Deliberately minimal — enough to correlate a running instance to a release,
 * nothing operationally sensitive. The full build/release/config surface lives
 * behind admin auth on `/admin/system/*` (SystemController).
 */
@ApiTags('version')
@Public()
@Controller({ path: 'version', version: VERSION_NEUTRAL })
export class VersionController {
  constructor(
    @Inject(deploymentConfig.KEY)
    private readonly deployment: ConfigType<typeof deploymentConfig>,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Public build/version identity (service, version, commit, environment).',
  })
  @ApiOkResponse({ description: 'Build identity of the running instance.' })
  version(): {
    service: string;
    version: string;
    commit: string;
    environment: string;
    releaseChannel: string;
  } {
    return {
      service: this.deployment.serviceName,
      version: this.deployment.version,
      commit: this.deployment.gitShaShort,
      environment: this.deployment.environment,
      releaseChannel: this.deployment.releaseChannel,
    };
  }
}
