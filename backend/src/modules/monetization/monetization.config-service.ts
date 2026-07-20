import { Injectable, Logger } from '@nestjs/common';
import {
  BillingInterval,
  DEFAULT_CREDITS_PER_USD,
  DEFAULT_CURRENCY,
  DEFAULT_GRACE_PERIOD_DAYS,
  DEFAULT_PLAN_FEATURES,
  DEFAULT_PLAN_LIMITS,
  DEFAULT_TRIAL_DAYS,
  PLAN_TIER_ORDER,
  PlanTier,
} from '@qalam/shared';
import type { PlanDefinition } from '@qalam/shared';

import { SettingsService } from '../settings/settings.service';
import type { SettingsActor } from '../settings/settings.util';
import { MONETIZATION_SETTING_KEYS } from './monetization.constants';
import type {
  MonetizationConfigPatch,
  ResolvedMonetizationConfig,
  ResolvedPlanCatalogue,
} from './monetization.types';

/**
 * Resolves the admin-tunable monetization config (AF5): the plan catalogue
 * (`monetization.plans`) and the cross-cutting config (`monetization.config`), each a
 * seeded JSON setting merged defensively over compiled defaults so a missing/partial/
 * legacy value never breaks billing. Reads reuse the Settings subsystem (Redis-cached);
 * writes go through the AUDITED settings write path — no bespoke config store, no
 * duplicated admin plumbing (mirrors AF4's `RetrievalConfigService`). This is the
 * configurable-pricing surface: regional pricing, currency conversion, feature bundles,
 * subscription/usage/promo pricing all live here as data, not code.
 */
@Injectable()
export class MonetizationConfigService {
  private readonly logger = new Logger(MonetizationConfigService.name);

  constructor(private readonly settings: SettingsService) {}

  /** The full plan catalogue (tier → definition). */
  async getPlans(): Promise<ResolvedPlanCatalogue> {
    try {
      const raw = await this.settings.getValue(MONETIZATION_SETTING_KEYS.Plans);
      return mergePlans(raw);
    } catch (error) {
      this.logger.warn(`plan config unavailable, using defaults: ${(error as Error).message}`);
      return compiledPlans();
    }
  }

  /** One plan by tier (or undefined if unknown). */
  async getPlan(tier: PlanTier): Promise<PlanDefinition | undefined> {
    return (await this.getPlans())[tier];
  }

  /** The cross-cutting config (credit rate, trial/grace, tax + currency tables). */
  async getConfig(): Promise<ResolvedMonetizationConfig> {
    try {
      const raw = await this.settings.getValue(MONETIZATION_SETTING_KEYS.Config);
      return mergeConfig(raw);
    } catch (error) {
      this.logger.warn(
        `monetization config unavailable, using defaults: ${(error as Error).message}`,
      );
      return DEFAULT_CONFIG;
    }
  }

  /** Admin update of the cross-cutting config (audited via the settings write path). */
  async updateConfig(
    patch: MonetizationConfigPatch,
    actor: SettingsActor,
  ): Promise<ResolvedMonetizationConfig> {
    const current = await this.getConfig();
    const next: ResolvedMonetizationConfig = {
      creditsPerUsd: patch.creditsPerUsd ?? current.creditsPerUsd,
      trialDays: patch.trialDays ?? current.trialDays,
      gracePeriodDays: patch.gracePeriodDays ?? current.gracePeriodDays,
      lowCreditThreshold: patch.lowCreditThreshold ?? current.lowCreditThreshold,
      taxRates: { ...current.taxRates, ...(patch.taxRates ?? {}) },
      currencyRates: { ...current.currencyRates, ...(patch.currencyRates ?? {}) },
      regionCurrency: { ...current.regionCurrency, ...(patch.regionCurrency ?? {}) },
    };
    await this.settings.updateSettings(
      [{ key: MONETIZATION_SETTING_KEYS.Config, value: next }],
      actor,
      'Update monetization config',
    );
    return next;
  }

  /** Admin replace of the plan catalogue (audited). */
  async updatePlans(
    plans: ResolvedPlanCatalogue,
    actor: SettingsActor,
  ): Promise<ResolvedPlanCatalogue> {
    await this.settings.updateSettings(
      [{ key: MONETIZATION_SETTING_KEYS.Plans, value: plans }],
      actor,
      'Update monetization plans',
    );
    return plans;
  }
}

/** The compiled default cross-cutting config (also the seeded `monetization.config`). */
export const DEFAULT_CONFIG: ResolvedMonetizationConfig = {
  creditsPerUsd: DEFAULT_CREDITS_PER_USD,
  trialDays: DEFAULT_TRIAL_DAYS,
  gracePeriodDays: DEFAULT_GRACE_PERIOD_DAYS,
  lowCreditThreshold: 500,
  taxRates: { default: 0, GB: 0.2, DE: 0.19, IN: 0.18, US: 0 },
  currencyRates: { usd: 1, eur: 0.92, gbp: 0.79, inr: 83, pkr: 278 },
  regionCurrency: { US: 'usd', GB: 'gbp', DE: 'eur', IN: 'inr', PK: 'pkr' },
};

/** The compiled default plan catalogue (also the seeded `monetization.plans`). */
export function compiledPlans(): ResolvedPlanCatalogue {
  const priceByTier: Record<PlanTier, Partial<Record<BillingInterval, number>>> = {
    [PlanTier.Free]: { [BillingInterval.None]: 0 },
    [PlanTier.Plus]: { [BillingInterval.Monthly]: 499, [BillingInterval.Yearly]: 4990 },
    [PlanTier.Pro]: { [BillingInterval.Monthly]: 1499, [BillingInterval.Yearly]: 14990 },
    [PlanTier.Enterprise]: { [BillingInterval.Monthly]: 4999, [BillingInterval.Yearly]: 49990 },
  };
  const names: Record<PlanTier, string> = {
    [PlanTier.Free]: 'Free',
    [PlanTier.Plus]: 'Plus',
    [PlanTier.Pro]: 'Pro',
    [PlanTier.Enterprise]: 'Enterprise',
  };
  const catalogue = {} as ResolvedPlanCatalogue;
  for (const tier of PLAN_TIER_ORDER) {
    const prices: PlanDefinition['prices'] = {};
    for (const [interval, cents] of Object.entries(priceByTier[tier])) {
      prices[interval as BillingInterval] = { [DEFAULT_CURRENCY]: cents };
    }
    catalogue[tier] = {
      tier,
      name: names[tier],
      description: `${names[tier]} plan`,
      features: [...DEFAULT_PLAN_FEATURES[tier]],
      limits: { ...DEFAULT_PLAN_LIMITS[tier] },
      monthlyCredits: DEFAULT_PLAN_LIMITS[tier].aiMonthlyCredits,
      prices,
      trialDays: tier === PlanTier.Free ? 0 : DEFAULT_TRIAL_DAYS,
    };
  }
  return catalogue;
}

function mergePlans(raw: unknown): ResolvedPlanCatalogue {
  const defaults = compiledPlans();
  if (raw === null || typeof raw !== 'object') {
    return defaults;
  }
  const stored = raw as Partial<Record<PlanTier, Partial<PlanDefinition>>>;
  const merged = {} as ResolvedPlanCatalogue;
  for (const tier of PLAN_TIER_ORDER) {
    merged[tier] = { ...defaults[tier], ...(stored[tier] ?? {}), tier };
  }
  return merged;
}

function mergeConfig(raw: unknown): ResolvedMonetizationConfig {
  if (raw === null || typeof raw !== 'object') {
    return DEFAULT_CONFIG;
  }
  const r = raw as Record<string, unknown>;
  return {
    creditsPerUsd: num(r.creditsPerUsd, DEFAULT_CONFIG.creditsPerUsd),
    trialDays: num(r.trialDays, DEFAULT_CONFIG.trialDays),
    gracePeriodDays: num(r.gracePeriodDays, DEFAULT_CONFIG.gracePeriodDays),
    lowCreditThreshold: num(r.lowCreditThreshold, DEFAULT_CONFIG.lowCreditThreshold),
    taxRates: mergeRecord(r.taxRates, DEFAULT_CONFIG.taxRates),
    currencyRates: mergeRecord(r.currencyRates, DEFAULT_CONFIG.currencyRates),
    regionCurrency: mergeStringRecord(r.regionCurrency, DEFAULT_CONFIG.regionCurrency),
  };
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function mergeRecord(value: unknown, defaults: Record<string, number>): Record<string, number> {
  if (value === null || typeof value !== 'object') {
    return { ...defaults };
  }
  return { ...defaults, ...(value as Record<string, number>) };
}

function mergeStringRecord(
  value: unknown,
  defaults: Record<string, string>,
): Record<string, string> {
  if (value === null || typeof value !== 'object') {
    return { ...defaults };
  }
  return { ...defaults, ...(value as Record<string, string>) };
}
