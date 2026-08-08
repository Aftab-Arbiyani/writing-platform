import { Injectable } from '@nestjs/common';
import {
  AI_MASTER_FLAG_KEY,
  AiFeature,
  FLAGGED_AI_FEATURES,
  aiFeatureFlagKey,
} from '@qalam/shared';

import { evaluateFeatureFlag } from '../settings/feature-flag-evaluator';
import { SettingsService } from '../settings/settings.service';
// The users module's own preference bag (`user_settings`) — aliased because this file
// already has a `SettingsService`, and the two are unrelated: that one is the platform
// feature-flag store, this one is per-user preferences.
import { SettingsService as UserPreferencesService } from '../users/settings.service';
import {
  AiDisabledByUserException,
  AiDisabledException,
  AiFeatureDisabledException,
} from './ai.exceptions';

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
 *
 * **B5 (docs/45 §4.10) adds a second, per-USER gate here**, in front of the
 * per-feature flags: an author may turn AI off for their own account. It lands in
 * this service rather than in each controller for the same reason the flags do —
 * this is the ONE place every AI path already passes through, so a per-controller
 * check would be a second authz path (the W3c-1 mistake) and would miss every AI
 * feature added later.
 *
 * **Precedence: admin off beats user on.** The master flag is the outer gate, so a
 * caller whose own switch is on still gets `AI_DISABLED` when the platform switch is
 * down — never `AI_DISABLED_BY_USER`, which would tell them to change a setting that
 * would not help.
 */
@Injectable()
export class AiFeatureService {
  constructor(
    private readonly settings: SettingsService,
    private readonly userPreferences: UserPreferencesService,
  ) {}

  /** Master AI switch (the platform's — B5's per-user switch is not part of it). */
  async isAiEnabled(): Promise<boolean> {
    return this.flagEnabled(AI_MASTER_FLAG_KEY);
  }

  /**
   * B5 — whether AI is on for this caller: the platform master switch AND the
   * caller's own preference. This is the value `GET /ai/features` reports as
   * `aiEnabled`, so an opted-out user sees exactly what a platform-wide shutdown
   * looks like, and every client gate that already reads it follows with no change.
   */
  async isAiEnabledForUser(userId: string): Promise<boolean> {
    if (!(await this.isAiEnabled())) {
      return false;
    }
    return this.userPreferences.isAiEnabledFor(userId);
  }

  /** Whether a specific feature is usable for this caller (master AND user AND its own flag). */
  async isFeatureEnabled(feature: AiFeature, userId: string): Promise<boolean> {
    if (!(await this.isAiEnabledForUser(userId))) {
      return false;
    }
    if (feature === AiFeature.Playground) {
      return true;
    }
    return this.flagEnabled(aiFeatureFlagKey(feature));
  }

  /**
   * Throw unless the feature is enabled for this caller
   * (AI_DISABLED / AI_DISABLED_BY_USER / AI_FEATURE_DISABLED).
   *
   * Order is the precedence rule and is not incidental: the platform switch is
   * checked first (admin off beats user on), then B5's per-user switch, then the
   * feature's own flag. `playground` rides the master flag alone, but NOT the user
   * switch — an author who turned AI off has turned off the playground too.
   */
  async assertEnabled(feature: AiFeature, userId: string): Promise<void> {
    if (!(await this.isAiEnabled())) {
      throw new AiDisabledException();
    }
    if (!(await this.userPreferences.isAiEnabledFor(userId))) {
      throw new AiDisabledByUserException();
    }
    if (feature === AiFeature.Playground) {
      return;
    }
    if (!(await this.flagEnabled(aiFeatureFlagKey(feature)))) {
      throw new AiFeatureDisabledException(feature);
    }
  }

  /**
   * Effective state of every flagged AI feature FOR THIS CALLER (`GET /ai/features`).
   *
   * B5 gave this a `userId`: the endpoint's contract has always been "which AI
   * features are enabled **for you**", and until now the only per-caller input was
   * the flag rollout. An opted-out user now gets `aiEnabled: false` and every feature
   * `false`, which is what makes the client halves small — both clients already gate
   * on this response.
   */
  async listFeatureStates(
    userId: string,
  ): Promise<{ aiEnabled: boolean; userAiEnabled: boolean; features: AiFeatureState[] }> {
    const flags = await this.settings.getFeatureFlags();
    // Effective (env-scope + rollout aware) state, not the raw `enabled` column.
    const enabledByKey = new Map(flags.map((flag) => [flag.key, evaluateFeatureFlag(flag)]));
    const platformEnabled = enabledByKey.get(AI_MASTER_FLAG_KEY) ?? false;
    const userAiEnabled = await this.userPreferences.isAiEnabledFor(userId);
    // Admin off beats user on: the master switch is ANDed in, never overridden.
    const aiEnabled = platformEnabled && userAiEnabled;
    const features = FLAGGED_AI_FEATURES.map((feature) => {
      const flagKey = aiFeatureFlagKey(feature);
      return { feature, flagKey, enabled: aiEnabled && (enabledByKey.get(flagKey) ?? false) };
    });
    /**
     * `userAiEnabled` is reported alongside so a client can tell the two "off" causes
     * apart and offer the right remedy — "you turned AI off, turn it back on in
     * settings" vs an administrator's platform switch, where there is nothing the
     * reader can do. Without it every client would have to infer the reason from a
     * second endpoint, and the wrong copy is exactly the W4 defect (docs/48 §3.6).
     */
    return { aiEnabled, userAiEnabled, features };
  }

  private async flagEnabled(key: string): Promise<boolean> {
    const flags = await this.settings.getFeatureFlags();
    const flag = flags.find((f) => f.key === key);
    return flag !== undefined && evaluateFeatureFlag(flag);
  }
}
