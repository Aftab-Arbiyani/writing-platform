import { Injectable } from '@nestjs/common';
import {
  AI_MASTER_FLAG_KEY,
  AiFeature,
  FLAGGED_AI_FEATURES,
  aiFeatureFlagKey,
} from '@qalam/shared';

import { SettingsService } from '../settings/settings.service';
import { AiDisabledException, AiFeatureDisabledException } from './ai.exceptions';

/** Effective on/off state of one AI feature for the caller. */
export interface AiFeatureState {
  feature: AiFeature;
  flagKey: string;
  enabled: boolean;
}

/**
 * The AI feature-flag gate (AF1). REUSES the existing feature-flag subsystem
 * (`SettingsService.getFeatureFlags`, Redis-cached) — it does NOT build a
 * parallel flag store. A feature is on only when the master `feature.ai.enabled`
 * AND its own `feature.ai.<name>.enabled` flag are on. `playground` (infra
 * surface) rides the master flag alone. Every AI entry point calls
 * {@link assertEnabled} first.
 */
@Injectable()
export class AiFeatureService {
  constructor(private readonly settings: SettingsService) {}

  /** Master AI switch. */
  async isAiEnabled(): Promise<boolean> {
    return this.flagEnabled(AI_MASTER_FLAG_KEY);
  }

  /** Whether a specific feature is usable (master AND its own flag). */
  async isFeatureEnabled(feature: AiFeature): Promise<boolean> {
    if (!(await this.isAiEnabled())) {
      return false;
    }
    if (feature === AiFeature.Playground) {
      return true;
    }
    return this.flagEnabled(aiFeatureFlagKey(feature));
  }

  /** Throw unless the feature is enabled (AI_DISABLED / AI_FEATURE_DISABLED). */
  async assertEnabled(feature: AiFeature): Promise<void> {
    if (!(await this.isAiEnabled())) {
      throw new AiDisabledException();
    }
    if (feature === AiFeature.Playground) {
      return;
    }
    if (!(await this.flagEnabled(aiFeatureFlagKey(feature)))) {
      throw new AiFeatureDisabledException(feature);
    }
  }

  /** Effective state of every flagged AI feature (for `GET /ai/features`). */
  async listFeatureStates(): Promise<{ aiEnabled: boolean; features: AiFeatureState[] }> {
    const flags = await this.settings.getFeatureFlags();
    const enabledByKey = new Map(flags.map((flag) => [flag.key, flag.enabled]));
    const aiEnabled = enabledByKey.get(AI_MASTER_FLAG_KEY) ?? false;
    const features = FLAGGED_AI_FEATURES.map((feature) => {
      const flagKey = aiFeatureFlagKey(feature);
      return { feature, flagKey, enabled: aiEnabled && (enabledByKey.get(flagKey) ?? false) };
    });
    return { aiEnabled, features };
  }

  private async flagEnabled(key: string): Promise<boolean> {
    const flags = await this.settings.getFeatureFlags();
    return flags.find((flag) => flag.key === key)?.enabled ?? false;
  }
}
