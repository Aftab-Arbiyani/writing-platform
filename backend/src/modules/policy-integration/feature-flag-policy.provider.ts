import { Injectable, type OnModuleInit } from '@nestjs/common';

import { PolicyEngineService } from '../policy';
import type { PolicyFeatureFlagPort } from '../policy/policy.types';
import { evaluateFeatureFlag } from '../settings/feature-flag-evaluator';
import { SettingsService } from '../settings/settings.service';

/**
 * Bridges the existing feature-flag subsystem into the Policy Engine as its
 * feature-flag input (AF6) — the master kill-switch for the collaboration
 * platform. Self-registers at bootstrap. Fails OPEN: an ABSENT flag reads as
 * enabled (unlike monetization's dark-launch default), so collaboration is on
 * unless an admin explicitly seeds `feature.collaboration.enabled = false`.
 */
@Injectable()
export class FeatureFlagPolicyProvider implements PolicyFeatureFlagPort, OnModuleInit {
  constructor(
    private readonly engine: PolicyEngineService,
    private readonly settings: SettingsService,
  ) {}

  onModuleInit(): void {
    this.engine.registerFeatureFlagPort(this);
  }

  async isEnabled(flagKey: string): Promise<boolean> {
    const flags = await this.settings.getFeatureFlags();
    const flag = flags.find((f) => f.key === flagKey);
    // Fails OPEN: an absent flag reads as enabled (collaboration default-on).
    return flag === undefined ? true : evaluateFeatureFlag(flag);
  }
}
