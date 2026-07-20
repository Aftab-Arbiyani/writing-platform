import { Injectable, type OnModuleInit } from '@nestjs/common';
import { PremiumFeature } from '@qalam/shared';

import { EntitlementService } from '../monetization/entitlement.service';
import { PolicyEngineService } from '../policy';
import type { PolicyEntitlementPort } from '../policy/policy.types';

const PREMIUM_FEATURES = new Set<string>(Object.values(PremiumFeature));

/**
 * Bridges the AF5 Entitlement Service into the Policy Engine as its entitlement
 * input (AF6). Self-registers at bootstrap — the engine has no compile-time
 * dependency on monetization. Unknown feature strings are treated as
 * non-premium (allowed), so only catalogued {@link PremiumFeature}s gate.
 */
@Injectable()
export class EntitlementPolicyProvider implements PolicyEntitlementPort, OnModuleInit {
  constructor(
    private readonly engine: PolicyEngineService,
    private readonly entitlements: EntitlementService,
  ) {}

  onModuleInit(): void {
    this.engine.registerEntitlementPort(this);
  }

  async isEntitled(userId: string, feature: string): Promise<boolean> {
    if (!PREMIUM_FEATURES.has(feature)) {
      return true;
    }
    const decision = await this.entitlements.decide(userId, feature as PremiumFeature);
    return decision.allowed;
  }
}
