import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import {
  AI_FEATURE_PREMIUM_CODE,
  BillingInterval,
  DEFAULT_CURRENCY,
  DEFAULT_GRACE_PERIOD_DAYS,
  DEFAULT_PLAN_FEATURES,
  DEFAULT_PLAN_LIMITS,
  DEFAULT_TRIAL_DAYS,
  PLAN_TIER_ORDER,
  PlanTier,
  PremiumFeature,
  UNIVERSAL_PLAN_FEATURES,
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
export class MonetizationConfigService implements OnModuleInit {
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
      trialDays: patch.trialDays ?? current.trialDays,
      gracePeriodDays: patch.gracePeriodDays ?? current.gracePeriodDays,
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

  /**
   * Paid tiers whose RESOLVED catalogue omits a premium code the compiled default grants
   * and the server actually ENFORCES — i.e. the states in which a PAYING subscriber is
   * refused a capability they bought.
   *
   * This exists because D3 changed what a `features` array *is*. Until D3 the arrays drove
   * display plus a single `ai_budget` assertion; from D3 they gate a live capability, so a
   * stored catalogue that has drifted from the compiled default now has consequences it did
   * not have when it was written. `mergePlans` spreads a stored tier wholesale (only
   * `limits` merges per key), and settings rows insert with `orIgnore()`, so a stored
   * `features` array REPLACES the compiled one forever.
   *
   * It reports and does not repair, and that is the deliberate call where the two
   * constraints conflict. Auto-healing a missing code would silently overwrite an admin who
   * removed it on purpose — and because a stored array replaces rather than merges, there is
   * no way to distinguish "stale seed" from "deliberate edit" by inspecting the value. So
   * the admin's intent is privileged and the dangerous state is made LOUD instead. Nothing
   * here is required for a seeded deployment: `monetization.plans` was born with `ai_writing`
   * on plus/pro/enterprise in the same commit that created the setting (`14b8bec`), so no
   * seeded install can lack it. This covers the hand-edited case only.
   */
  async auditEnforcedPaidFeatures(): Promise<
    ReadonlyArray<{ tier: PlanTier; feature: PremiumFeature }>
  > {
    return driftedPaidEntitlements(await this.getPlans());
  }

  /**
   * Warn once at boot rather than on every catalogue read — a drifted deployment would
   * otherwise log on every AI request. Never throws: `getPlans` already falls back to the
   * compiled defaults, and a diagnostic must not be able to stop the app from starting.
   */
  async onModuleInit(): Promise<void> {
    try {
      for (const { tier, feature } of await this.auditEnforcedPaidFeatures()) {
        this.logger.warn(
          `monetization.plans: paid tier "${tier}" does not grant the ENFORCED premium code ` +
            `"${feature}" — subscribers on this tier will be DENIED it (402 ENTITLEMENT_DENIED). ` +
            `The compiled default grants it; the stored catalogue overrides that. Fix the ` +
            `stored value via the admin settings surface if this was not deliberate.`,
        );
      }
    } catch (error) {
      this.logger.warn(`paid-tier entitlement audit skipped: ${(error as Error).message}`);
    }
  }
}

/**
 * The premium codes the server ASSERTS today: the AI budget (checked by the usage meter on
 * every AI request) plus every code the AI feature map sells a feature behind (D3 —
 * `ai_writing`). Derived rather than listed, so when D4 finally enforces its six codes the
 * audit above widens with it instead of quietly going stale.
 */
const ENFORCED_PREMIUM_FEATURES: ReadonlySet<PremiumFeature> = new Set<PremiumFeature>([
  PremiumFeature.AiBudget,
  ...Object.values(AI_FEATURE_PREMIUM_CODE).flatMap((code) => (code === null ? [] : [code])),
]);

/** Pure core of {@link MonetizationConfigService.auditEnforcedPaidFeatures}. */
export function driftedPaidEntitlements(
  catalogue: ResolvedPlanCatalogue,
): ReadonlyArray<{ tier: PlanTier; feature: PremiumFeature }> {
  const drift: Array<{ tier: PlanTier; feature: PremiumFeature }> = [];
  for (const tier of PLAN_TIER_ORDER) {
    if (tier === PlanTier.Free) {
      continue; // Free is not sold anything; its omissions are the product, not drift.
    }
    const granted = new Set<PremiumFeature>(catalogue[tier].features);
    for (const feature of DEFAULT_PLAN_FEATURES[tier]) {
      if (ENFORCED_PREMIUM_FEATURES.has(feature) && !granted.has(feature)) {
        drift.push({ tier, feature });
      }
    }
  }
  return drift;
}

/** The compiled default cross-cutting config (also the seeded `monetization.config`). */
export const DEFAULT_CONFIG: ResolvedMonetizationConfig = {
  trialDays: DEFAULT_TRIAL_DAYS,
  gracePeriodDays: DEFAULT_GRACE_PERIOD_DAYS,
  taxRates: { default: 0, GB: 0.2, DE: 0.19, IN: 0.18, US: 0 },
  currencyRates: { usd: 1, eur: 0.92, gbp: 0.79, inr: 83, pkr: 278 },
  regionCurrency: { US: 'usd', GB: 'gbp', DE: 'eur', IN: 'inr', PK: 'pkr' },
};

/** The compiled default plan catalogue (also the seeded `monetization.plans`). */
/**
 * A tier's features with D4's universally-included codes folded in, de-duplicated and order-stable.
 *
 * Order matters only for display — both clients render `plan.features` in the order the server sends
 * — so the tier's own codes come first and the universal ones follow, which keeps what a tier BUYS
 * at the top of every plan card.
 */
function withUniversalFeatures(features: readonly PremiumFeature[] = []): PremiumFeature[] {
  return [...new Set<PremiumFeature>([...features, ...UNIVERSAL_PLAN_FEATURES])];
}

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
      features: withUniversalFeatures(DEFAULT_PLAN_FEATURES[tier]),
      limits: { ...DEFAULT_PLAN_LIMITS[tier] },
      monthlyCredits: DEFAULT_PLAN_LIMITS[tier].aiMonthlyCredits,
      prices,
      trialDays: tier === PlanTier.Free ? 0 : DEFAULT_TRIAL_DAYS,
    };
  }
  return catalogue;
}

/**
 * Folds the stored catalogue over the compiled defaults, tier by tier.
 *
 * `limits` merges one level DEEPER than the rest of the definition, and that is load-bearing.
 * `SettingsRepository.syncDefinitions` inserts with `orIgnore()`, so an existing deployment keeps
 * whatever `monetization.plans` JSON it was first seeded with — forever. With a flat spread, a
 * stored `limits` object replaces the compiled one wholesale, so a limit key added to the catalogue
 * *after* that row was written (B4's `maxPieces`, docs/45 §4.9) would read as absent, absent means
 * unlimited, and the new cap would be silently inert on every deployment except a fresh database.
 * Merging per key means a new default reaches existing installs while an admin's explicit value for
 * any key still wins (it is spread last; `0` is how an admin says "unlimited").
 *
 * **One key does not obey that last sentence: `maxCollaborators` (B6, docs/45 §4.11).** Free is
 * genuinely zero seats, so for that key `0` means NONE and `UNLIMITED_SEATS` (-1) means unlimited —
 * the inverse of what the promise above would lead an admin to expect. The deviation is stated in
 * the admin-facing `description` of the `monetization.plans` setting (which the admin Settings UI
 * renders), declared in `NEGATIVE_UNLIMITED_LIMIT_KEYS`, applied by `resolvePlanLimit` (the only
 * correct way to read a limit), and pinned below by the spec that asserts an admin's stored `0`
 * resolves to *unlimited pieces* and *zero seats* from the same merge. Do not "normalise" the two
 * conventions into one: doing so silently either bricks paid collaboration or gives it away free.
 */
function mergePlans(raw: unknown): ResolvedPlanCatalogue {
  const defaults = compiledPlans();
  if (raw === null || typeof raw !== 'object') {
    return defaults;
  }
  const stored = raw as Partial<Record<PlanTier, Partial<PlanDefinition>>>;
  const merged = {} as ResolvedPlanCatalogue;
  for (const tier of PLAN_TIER_ORDER) {
    const storedTier = stored[tier] ?? {};
    merged[tier] = {
      ...defaults[tier],
      ...storedTier,
      limits: { ...defaults[tier].limits, ...(storedTier.limits ?? {}) },
      /**
       * **D4's five universally-included codes are unioned back in AFTER the stored spread**, which
       * is the whole reason this row is a code change rather than a catalogue edit.
       *
       * A stored `features` array replaces the compiled one wholesale (see the note above — only
       * `limits` merges per key), so a deployment seeded before 2026-08-21 would keep listing the
       * five as paid forever and a free account would be told it lacks capabilities it has been
       * using all along. Editing `DEFAULT_PLAN_FEATURES` alone would have been INERT everywhere that
       * matters. D3 escaped this trap by needing no catalogue edit (§6.13); D4 cannot, so the
       * decision is applied at resolution instead.
       *
       * The union is deliberately one-way: an operator can still ADD codes to a tier, and can still
       * curate the three enforced ones, but cannot subtract a code the owner declared free — which
       * is the correct asymmetry for a decision rather than a configuration.
       */
      features: withUniversalFeatures(storedTier.features ?? defaults[tier].features),
      tier,
    };
  }
  return merged;
}

function mergeConfig(raw: unknown): ResolvedMonetizationConfig {
  if (raw === null || typeof raw !== 'object') {
    return DEFAULT_CONFIG;
  }
  const r = raw as Record<string, unknown>;
  return {
    trialDays: num(r.trialDays, DEFAULT_CONFIG.trialDays),
    gracePeriodDays: num(r.gracePeriodDays, DEFAULT_CONFIG.gracePeriodDays),
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
