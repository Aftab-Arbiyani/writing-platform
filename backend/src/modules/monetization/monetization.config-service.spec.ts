import { PlanTier } from '@qalam/shared';

import { MonetizationConfigService } from './monetization.config-service';
import type { SettingsService } from '../settings/settings.service';

/**
 * The plan catalogue's merge behaviour, which is what decides whether a limit added to the
 * compiled defaults ever reaches a running deployment.
 *
 * `SettingsRepository.syncDefinitions` inserts with `orIgnore()`, so the `monetization.plans` row a
 * database was first seeded with is the row it keeps. Everything here is therefore about the case
 * that matters in production and never in a fresh test database: **a stored catalogue written
 * before the limit existed.**
 */

function serviceReading(stored: unknown): MonetizationConfigService {
  const settings = { getValue: jest.fn().mockResolvedValue(stored) };
  return new MonetizationConfigService(settings as unknown as SettingsService);
}

/** A catalogue as it was stored before B4 — every tier's `limits` has no `maxPieces`. */
const PRE_B4_CATALOGUE = {
  free: {
    tier: 'free',
    name: 'Free',
    limits: { aiDailyTokens: 20000, aiMonthlyTokens: 200000, aiMonthlyCredits: 0 },
  },
  plus: {
    tier: 'plus',
    name: 'Plus',
    limits: { aiDailyTokens: 100000, aiMonthlyTokens: 2000000, aiMonthlyCredits: 5000 },
  },
};

describe('MonetizationConfigService — plan catalogue merge', () => {
  it('ships the B4 piece caps as compiled defaults (25 / 250 / unlimited / unlimited)', async () => {
    const service = serviceReading(null);
    const plans = await service.getPlans();
    expect(plans[PlanTier.Free].limits.maxPieces).toBe(25);
    expect(plans[PlanTier.Plus].limits.maxPieces).toBe(250);
    expect(plans[PlanTier.Pro].limits.maxPieces).toBe(0);
    expect(plans[PlanTier.Enterprise].limits.maxPieces).toBe(0);
  });

  it('reaches a catalogue stored before the limit existed', async () => {
    // Without a per-key merge of `limits` this reads `undefined` — absent means unlimited, so the
    // cap would be silently inert on every deployment except a brand-new database.
    const plans = await serviceReading(PRE_B4_CATALOGUE).getPlans();
    expect(plans[PlanTier.Free].limits.maxPieces).toBe(25);
    expect(plans[PlanTier.Plus].limits.maxPieces).toBe(250);
  });

  it('keeps the stored values for keys the admin did set', async () => {
    const plans = await serviceReading(PRE_B4_CATALOGUE).getPlans();
    expect(plans[PlanTier.Free].limits.aiDailyTokens).toBe(20000);
  });

  it('lets an admin override the new limit, including to 0 for unlimited', async () => {
    const plans = await serviceReading({
      free: { limits: { aiDailyTokens: 1, maxPieces: 5 } },
      plus: { limits: { maxPieces: 0 } },
    }).getPlans();
    expect(plans[PlanTier.Free].limits.maxPieces).toBe(5);
    expect(plans[PlanTier.Plus].limits.maxPieces).toBe(0);
    // A partial `limits` still inherits the keys it does not mention.
    expect(plans[PlanTier.Free].limits.aiMonthlyTokens).toBe(200_000);
  });

  it('falls back to compiled defaults when the setting cannot be read', async () => {
    const settings = { getValue: jest.fn().mockRejectedValue(new Error('settings down')) };
    const plans = await new MonetizationConfigService(
      settings as unknown as SettingsService,
    ).getPlans();
    expect(plans[PlanTier.Free].limits.maxPieces).toBe(25);
  });
});
