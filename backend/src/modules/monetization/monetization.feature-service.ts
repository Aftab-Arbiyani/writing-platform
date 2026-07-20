import { Injectable } from '@nestjs/common';
import { MONETIZATION_MASTER_FLAG_KEY } from '@qalam/shared';

import { evaluateFeatureFlag } from '../settings/feature-flag-evaluator';
import { SettingsService } from '../settings/settings.service';
import { MonetizationDisabledException } from './monetization.exceptions';

/**
 * The monetization feature-flag gate (AF5). REUSES the existing feature-flag subsystem
 * (`SettingsService.getFeatureFlags`, Redis-cached) exactly like `AiFeatureService` — it
 * does NOT build a parallel flag store. The whole platform rides the pre-seeded
 * `feature.payments.enabled` flag, so it is dark-launchable and admin-toggleable through
 * the existing `/admin/feature-flags` surface. Mutating monetization entry points call
 * {@link assertEnabled} first; read-only entitlement checks stay available so premium
 * gating degrades safely (deny) rather than erroring when the platform is off.
 */
@Injectable()
export class MonetizationFeatureService {
  constructor(private readonly settings: SettingsService) {}

  async isEnabled(): Promise<boolean> {
    const flags = await this.settings.getFeatureFlags();
    const flag = flags.find((f) => f.key === MONETIZATION_MASTER_FLAG_KEY);
    return flag !== undefined && evaluateFeatureFlag(flag);
  }

  /** Throw MONETIZATION_DISABLED unless the platform flag is on. */
  async assertEnabled(): Promise<void> {
    if (!(await this.isEnabled())) {
      throw new MonetizationDisabledException();
    }
  }
}
