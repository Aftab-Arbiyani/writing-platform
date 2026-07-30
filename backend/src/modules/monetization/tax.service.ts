import { Injectable } from '@nestjs/common';

import { MonetizationConfigService } from './monetization.config-service';

/** A computed tax line for an amount in a region. */
export interface TaxResult {
  region: string;
  rate: number;
  /** Tax amount in the same minor units as the input. */
  tax: number;
}

/**
 * The Tax service (AF5) — computes tax for a charge from the admin-configured per-region
 * rate table (`monetization.config.taxRates`). Config-driven, so rates change without a
 * deploy; a region with no configured rate falls back to `default`. Kept a distinct
 * service so a future integration (e.g. a tax provider like Stripe Tax / TaxJar) replaces
 * only this class — everything else calls `computeTax` and is unaffected.
 */
@Injectable()
export class TaxService {
  constructor(private readonly config: MonetizationConfigService) {}

  /** Tax on `amount` (minor units) for a region code (rounds to whole minor units). */
  async computeTax(amount: number, region: string | null): Promise<TaxResult> {
    const config = await this.config.getConfig();
    const key = region ?? 'default';
    const rate = config.taxRates[key] ?? config.taxRates.default ?? 0;
    return { region: key, rate, tax: Math.round(amount * rate) };
  }
}
