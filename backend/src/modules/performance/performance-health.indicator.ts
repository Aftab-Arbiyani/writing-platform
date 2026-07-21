import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import type { HealthIndicatorResult } from '@nestjs/terminus';

import { PerformanceVerificationService } from './verification/performance-verification.service';

/**
 * Performance health probe (P7.3) — reports `up` while no server-measured
 * performance budget is being violated, `down` (with the violating budget ids)
 * otherwise. Mirrors {@link QueueHealthIndicator}; wired into `/health/deep` and
 * a dedicated `/health/performance` probe. This is the "Performance Health"
 * observability signal — measurement only, no alerting (P7.4 owns that).
 *
 * `down` here is INFORMATIONAL: it must not fail `/health/ready` (a budget breach
 * is a degradation signal, not an instance-unhealthy signal), so it is exposed
 * on `/health/deep` and `/health/performance`, never on the readiness gate.
 */
@Injectable()
export class PerformanceHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly verification: PerformanceVerificationService,
  ) {}

  isHealthy(key: string): HealthIndicatorResult {
    const indicator = this.healthIndicatorService.check(key);
    const outcome = this.verification.verify();
    const payload = {
      passed: outcome.passed,
      failed: outcome.failed,
      notMeasured: outcome.notMeasured,
      violations: outcome.violations.map((v) => v.id),
    };
    return outcome.ok
      ? indicator.up(payload)
      : indicator.down({ ...payload, message: 'performance budget violation' });
  }
}
