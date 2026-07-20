import { Injectable } from '@nestjs/common';
import { BillingInterval, DEFAULT_CURRENCY, PlanTier } from '@qalam/shared';
import type { PlanDefinition } from '@qalam/shared';

import { MonetizationConfigService } from './monetization.config-service';
import { PlanNotFoundException } from './monetization.exceptions';
import { PromotionService } from './promotion.service';
import type { ComputedPrice } from './monetization.types';

/**
 * The Pricing service (AF5) — configurable pricing over the plan catalogue. Resolves the
 * list price for a (tier, interval, currency): a currency without an explicit price is
 * derived from the USD base via the config's currency-conversion table (regional pricing).
 * `computeCheckout` applies a coupon's discount to produce the net charge. All pricing is
 * DATA (admin-tunable config), never hard-coded — future dynamic/usage-based pricing plugs
 * in here without touching callers.
 */
@Injectable()
export class PricingService {
  constructor(
    private readonly config: MonetizationConfigService,
    private readonly promotions: PromotionService,
  ) {}

  /** The public plan catalogue for the comparison screen. */
  async listPlans(): Promise<PlanDefinition[]> {
    const catalogue = await this.config.getPlans();
    return Object.values(catalogue);
  }

  /** Preferred currency for a region code (regional pricing), else the default. */
  async currencyForRegion(region: string | null): Promise<string> {
    if (region === null) {
      return DEFAULT_CURRENCY;
    }
    const config = await this.config.getConfig();
    return config.regionCurrency[region] ?? DEFAULT_CURRENCY;
  }

  /** List price (minor units) for a plan+interval in a currency. */
  async priceFor(tier: PlanTier, interval: BillingInterval, currency: string): Promise<number> {
    const plan = await this.config.getPlan(tier);
    if (plan === undefined) {
      throw new PlanNotFoundException(tier);
    }
    return this.resolvePrice(plan, interval, currency, await this.config.getConfig());
  }

  /** The net charge for a checkout, applying a coupon discount if provided. */
  async computeCheckout(
    tier: PlanTier,
    interval: BillingInterval,
    currency: string,
    couponCode?: string,
  ): Promise<ComputedPrice> {
    const amount = await this.priceFor(tier, interval, currency);
    let discount = 0;
    if (couponCode !== undefined && couponCode !== '' && amount > 0) {
      const validation = await this.promotions.validate(couponCode, amount, tier, interval);
      discount = validation.discountedAmount ?? 0;
    }
    return { tier, interval, currency, amount, discount, net: Math.max(0, amount - discount) };
  }

  private resolvePrice(
    plan: PlanDefinition,
    interval: BillingInterval,
    currency: string,
    config: { currencyRates: Record<string, number> },
  ): number {
    const byCurrency = plan.prices[interval] ?? {};
    const explicit = byCurrency[currency];
    if (explicit !== undefined) {
      return explicit;
    }
    // Derive from the USD base via the conversion table (regional pricing fallback).
    const usd = byCurrency[DEFAULT_CURRENCY] ?? 0;
    const rate = config.currencyRates[currency] ?? 1;
    return Math.round(usd * rate);
  }
}
