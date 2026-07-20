import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import type { HealthIndicatorResult } from '@nestjs/terminus';

import { ConfigInspectorService } from '../../config/config-inspector.service';

/**
 * Config/secret health (P7.1). Reports whether required configuration and
 * secrets are present and valid for the current environment — values are never
 * exposed, only the aggregate status, fingerprint and issue list. Goes `down`
 * only when a *required* secret is missing/invalid on a protected tier (which
 * boot validation would normally already have caught — this guards against
 * runtime secret-file rotation to an empty value).
 */
@Injectable()
export class ConfigHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly inspector: ConfigInspectorService,
  ) {}

  isHealthy(key: string): HealthIndicatorResult {
    const indicator = this.healthIndicatorService.check(key);
    const report = this.inspector.report();
    const detail = {
      configStatus: report.status,
      environment: report.environment,
      configVersion: report.configVersion,
      fingerprint: report.fingerprint,
      issues: report.issues,
    };
    return report.status === 'error' ? indicator.down(detail) : indicator.up(detail);
  }
}
