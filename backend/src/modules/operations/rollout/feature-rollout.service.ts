import { Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@qalam/shared';

import { SettingsService } from '../../settings/settings.service';
import type { SettingsActor } from '../../settings/settings.util';
import { evaluateFeatureFlag } from '../../settings/feature-flag-evaluator';
import type { FeatureFlagDto } from '../../settings/dto/feature-flag.dto';
import { getOperationsObserver } from '../../../common/operations/operations-observer.port';
import { OperationsException } from '../operations.exceptions';
import type { RolloutState } from '../operations.types';

/**
 * Feature Rollout Platform (P7.4) — percentage / canary / environment rollouts,
 * kill switches, and emergency disable. It is a THIN operational surface over the
 * EXISTING E12.8 feature-flag subsystem (`SettingsService` + the durable
 * `feature_flags` table + `evaluateFeatureFlag`): no new table, no parallel
 * rollout engine. Every mutation flows through `SettingsService`, which already
 * audits + cache-invalidates it (rollout audit for free); we additionally emit an
 * ops signal so a rollout change is visible on the deployment/rollout timeline.
 *
 * "Rollback integration" = flip the flag off (kill switch / emergency disable),
 * which is exactly the existing gate the rest of the platform reads — so a kill
 * switch instantly and centrally disables the feature everywhere.
 */
@Injectable()
export class FeatureRolloutService {
  constructor(private readonly settings: SettingsService) {}

  /** Every rollout's current state (projection over the feature flags). */
  async list(): Promise<RolloutState[]> {
    const flags = await this.settings.getFeatureFlags();
    return flags.map((f) => this.project(f));
  }

  /** One rollout's state (404 when the key has no backing flag). */
  async get(key: string): Promise<RolloutState> {
    return this.project(await this.requireFlag(key));
  }

  /** Set the rollout percentage (0..100); enables the flag. Canary = a low %. */
  async setPercentage(
    key: string,
    percentage: number,
    actor: SettingsActor,
  ): Promise<RolloutState> {
    if (!Number.isInteger(percentage) || percentage < 0 || percentage > 100) {
      throw new OperationsException(
        ERROR_CODES.OPERATIONS_INVALID_ROLLOUT,
        'rollout percentage must be an integer between 0 and 100',
      );
    }
    const flag = await this.requireFlag(key);
    const updated = await this.settings.updateFeatureFlag(
      flag.id,
      { enabled: percentage > 0, rolloutPercentage: percentage },
      actor,
    );
    this.emit(key, 'percentage', true);
    return this.project(updated);
  }

  /** Fully enable (100%) a rollout. */
  async enable(key: string, actor: SettingsActor): Promise<RolloutState> {
    const flag = await this.requireFlag(key);
    const updated = await this.settings.updateFeatureFlag(
      flag.id,
      { enabled: true, rolloutPercentage: 100 },
      actor,
    );
    this.emit(key, 'enable', true);
    return this.project(updated);
  }

  /**
   * KILL SWITCH / emergency disable — turn the feature off everywhere at once.
   * This is the rollback lever: the flag is the gate the whole platform reads, so
   * disabling it removes the feature immediately without a deploy.
   */
  async killSwitch(key: string, actor: SettingsActor): Promise<RolloutState> {
    const flag = await this.requireFlag(key);
    const updated = await this.settings.updateFeatureFlag(flag.id, { enabled: false }, actor);
    this.emit(key, 'kill-switch', false);
    return this.project(updated);
  }

  /** Evaluate a rollout for a subject (deterministic percentage bucketing). */
  async evaluate(key: string, subjectId?: string): Promise<boolean> {
    const flag = await this.requireFlag(key);
    return evaluateFeatureFlag(flag, { subjectId });
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private async requireFlag(key: string): Promise<FeatureFlagDto> {
    const flag = (await this.settings.getFeatureFlags()).find((f) => f.key === key);
    if (flag === undefined) {
      throw new OperationsException(
        ERROR_CODES.OPERATIONS_ROLLOUT_NOT_FOUND,
        `no feature rollout for key "${key}"`,
      );
    }
    return flag;
  }

  private project(flag: FeatureFlagDto): RolloutState {
    return {
      key: flag.key,
      enabled: flag.enabled,
      rolloutPercentage: flag.rolloutPercentage,
      environment: flag.environment,
      strategy: this.strategy(flag),
      killSwitchEngaged: !flag.enabled,
      description: flag.description,
    };
  }

  private strategy(flag: FeatureFlagDto): RolloutState['strategy'] {
    if (!flag.enabled) {
      return 'off';
    }
    if (flag.environment !== 'all') {
      return 'environment';
    }
    if (flag.rolloutPercentage <= 0 || flag.rolloutPercentage >= 100) {
      return 'full';
    }
    return flag.rolloutPercentage <= 25 ? 'canary' : 'percentage';
  }

  private emit(key: string, action: string, ok: boolean): void {
    getOperationsObserver()?.record({
      kind: 'rollout',
      name: `rollout.${action}`,
      ok,
      attributes: { key },
    });
  }
}
