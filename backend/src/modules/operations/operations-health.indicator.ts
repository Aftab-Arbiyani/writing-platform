import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import type { HealthIndicatorResult } from '@nestjs/terminus';

import { OperationalHealthService } from './health/operational-health.service';

/**
 * Operations health probe (P7.4) — reports `up` while the operational-health view
 * is not unhealthy, `down` (with the overall grade) otherwise. Mirrors the P7.3
 * performance indicator; wired into `/health/deep` and a dedicated
 * `/health/operations` probe.
 *
 * `down` here is INFORMATIONAL (a degradation signal, not an instance-unhealthy
 * signal), so it is exposed on `/health/deep` + `/health/operations`, never on
 * the readiness gate — a firing alert or open incident must not pull the instance
 * out of rotation.
 */
@Injectable()
export class OperationsHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly operationalHealth: OperationalHealthService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    const { ready, overall } = await this.operationalHealth.readiness();
    const payload = { overall, ready };
    return overall !== 'unhealthy'
      ? indicator.up(payload)
      : indicator.down({ ...payload, message: 'operational health degraded' });
  }
}
