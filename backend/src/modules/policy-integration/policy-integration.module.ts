import { Module } from '@nestjs/common';

import { MonetizationModule } from '../monetization/monetization.module';
import { SettingsModule } from '../settings/settings.module';
import { EntitlementPolicyProvider } from './entitlement-policy.provider';
import { FeatureFlagPolicyProvider } from './feature-flag-policy.provider';

/**
 * Wires the OPTIONAL Policy Engine inputs that live in other modules —
 * entitlements (AF5 Monetization) and feature flags (Settings) — into the
 * engine via self-registering adapters. Isolating this here keeps the Policy
 * Engine itself free of any dependency on monetization/settings (no cycles):
 * the engine ships standalone, and this module "plugs in" the extra inputs.
 */
@Module({
  imports: [MonetizationModule, SettingsModule],
  providers: [EntitlementPolicyProvider, FeatureFlagPolicyProvider],
})
export class PolicyIntegrationModule {}
