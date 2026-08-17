import {
  DEFAULT_PLAN_FEATURES,
  NEGATIVE_UNLIMITED_LIMIT_KEYS,
  PlanTier,
  PremiumFeature,
  UNLIMITED_SEATS,
  resolvePlanLimit,
} from '@qalam/shared';

import { DEFAULT_CONFIG, MonetizationConfigService } from './monetization.config-service';
import type { SettingsService } from '../settings/settings.service';
import { SETTING_DEFINITION_BY_KEY } from '../settings/settings.catalog';

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

  // ── B6 seats, and the sentinel it inverts (docs/45 §4.11) ───────────────────────────────────

  it('ships the B6 seat caps as compiled defaults (0 / 3 / unlimited / unlimited)', async () => {
    const plans = await serviceReading(null).getPlans();
    expect(plans[PlanTier.Free].limits.maxCollaborators).toBe(0);
    expect(plans[PlanTier.Plus].limits.maxCollaborators).toBe(3);
    expect(plans[PlanTier.Pro].limits.maxCollaborators).toBe(UNLIMITED_SEATS);
    expect(plans[PlanTier.Enterprise].limits.maxCollaborators).toBe(UNLIMITED_SEATS);
  });

  it('reaches a catalogue stored before B6 existed — the per-key merge still holds', async () => {
    // B4's guarantee, re-checked for B6's key: without the one-level-deeper spread of `limits`,
    // `maxCollaborators` would be absent on every existing deployment.
    const plans = await serviceReading(PRE_B4_CATALOGUE).getPlans();
    expect(plans[PlanTier.Free].limits.maxCollaborators).toBe(0);
    expect(plans[PlanTier.Plus].limits.maxCollaborators).toBe(3);
  });

  /**
   * THE reconciliation this row turns on. `mergePlans` promises admins that "`0` is how an admin
   * says unlimited", and that promise is false for exactly one key. Both halves are asserted from
   * ONE stored catalogue so the asymmetry is visible in a single expectation block: someone who
   * "normalises" the two conventions breaks this test whichever direction they normalise in.
   */
  it("an admin's stored 0 means unlimited pieces and ZERO seats — the two keys read opposite", async () => {
    const plans = await serviceReading({
      pro: { limits: { maxPieces: 0, maxCollaborators: 0 } },
    }).getPlans();
    const limits = plans[PlanTier.Pro].limits;

    expect(resolvePlanLimit(limits, 'maxPieces')).toEqual({ value: 0, unlimited: true });
    expect(resolvePlanLimit(limits, 'maxCollaborators')).toEqual({ value: 0, unlimited: false });
  });

  it('an admin says "unlimited collaborators" with -1, and it survives the merge', async () => {
    const plans = await serviceReading({
      free: { limits: { maxCollaborators: UNLIMITED_SEATS } },
    }).getPlans();
    expect(resolvePlanLimit(plans[PlanTier.Free].limits, 'maxCollaborators')).toEqual({
      value: -1,
      unlimited: true,
    });
  });

  it('the compiled Free tier is never read as unlimited seats', async () => {
    // The inversion regression, stated at the data layer: if `maxCollaborators` ever loses its
    // place in NEGATIVE_UNLIMITED_LIMIT_KEYS, or Free's 0 is "fixed" to match maxPieces, every free
    // author silently gets unlimited collaborators and no other test in this repo would notice.
    for (const stored of [null, PRE_B4_CATALOGUE, { free: { limits: { maxCollaborators: 0 } } }]) {
      const plans = await serviceReading(stored).getPlans();
      const seats = resolvePlanLimit(plans[PlanTier.Free].limits, 'maxCollaborators');
      expect(seats.unlimited).toBe(false);
      expect(seats.value).toBe(0);
    }
  });

  // ── B7 history depth, and the sentinel it does NOT invert (docs/45 §4.12) ────────────────────

  it('ships the B7 history depths as compiled defaults (5 / 25 / unlimited / unlimited)', async () => {
    const plans = await serviceReading(null).getPlans();
    expect(plans[PlanTier.Free].limits.maxSnapshotHistory).toBe(5);
    expect(plans[PlanTier.Plus].limits.maxSnapshotHistory).toBe(25);
    expect(plans[PlanTier.Pro].limits.maxSnapshotHistory).toBe(0);
    expect(plans[PlanTier.Enterprise].limits.maxSnapshotHistory).toBe(0);
  });

  it('reaches a catalogue stored before B7 existed — the per-key merge still holds', async () => {
    const plans = await serviceReading(PRE_B4_CATALOGUE).getPlans();
    expect(plans[PlanTier.Free].limits.maxSnapshotHistory).toBe(5);
    expect(plans[PlanTier.Plus].limits.maxSnapshotHistory).toBe(25);
  });

  /**
   * B7 rides the ORDINARY sentinel and B6 rides the inverted one, so the two are asserted from a
   * single stored catalogue: "fixing" B7 toward B6 — the one plausible mistake, since both read the
   * story owner's plan — turns Pro's unlimited history into a hard zero and fails here.
   */
  it("an admin's stored 0 means UNLIMITED history and ZERO seats", async () => {
    const plans = await serviceReading({
      pro: { limits: { maxSnapshotHistory: 0, maxCollaborators: 0 } },
    }).getPlans();
    const limits = plans[PlanTier.Pro].limits;

    expect(resolvePlanLimit(limits, 'maxSnapshotHistory')).toEqual({ value: 0, unlimited: true });
    expect(resolvePlanLimit(limits, 'maxCollaborators')).toEqual({ value: 0, unlimited: false });
  });

  it('the compiled Free tier reads as five visible versions, never as unlimited', async () => {
    for (const stored of [null, PRE_B4_CATALOGUE, { free: { limits: { aiDailyTokens: 1 } } }]) {
      const plans = await serviceReading(stored).getPlans();
      const depth = resolvePlanLimit(plans[PlanTier.Free].limits, 'maxSnapshotHistory');
      expect(depth).toEqual({ value: 5, unlimited: false });
    }
  });

  it('keeps maxSnapshotHistory OUT of the inverted-sentinel list', async () => {
    // The exception list is meant to stay at one entry. If B7's key is ever added to it, Pro and
    // Enterprise (`0`) stop being unlimited and start showing zero versions — a silent inversion
    // with no error anywhere, which is precisely how B6 warned this fails.
    expect(NEGATIVE_UNLIMITED_LIMIT_KEYS).toEqual(['maxCollaborators']);
  });
});

/**
 * D3's existing-deployment path (docs/45 §4 row D3, docs/48 §6.13).
 *
 * From this commit `ai_writing` is ENFORCED, which changes what a stored `features` array
 * means: it stopped being display data and became access control. These tests are about the
 * case that only exists in production — a `monetization.plans` row written before today and
 * kept forever by `orIgnore()`.
 */
describe('MonetizationConfigService — D3, AI writing is enforced', () => {
  /**
   * The catalogue exactly as `monetization.plans` was SEEDED (AF5, `14b8bec`) — free holds
   * `ai_budget` and nothing else. This is the row a pre-D3 deployment still has.
   */
  const STORED_OLD_CATALOGUE = {
    free: { tier: 'free', name: 'Free', features: ['ai_budget'] },
    plus: {
      tier: 'plus',
      name: 'Plus',
      features: ['ai_budget', 'ai_writing', 'ai_discovery', 'premium_search'],
    },
  };

  describe('the free tier', () => {
    it('resolves WITHOUT ai_writing on a database seeded before today — the regression is live', async () => {
      const plans = await serviceReading(STORED_OLD_CATALOGUE).getPlans();

      expect(plans[PlanTier.Free].features).not.toContain(PremiumFeature.AiWriting);
    });

    it('KEEPS ai_budget, because free can still spend it (DECISION 2a)', async () => {
      // 48 §5.2 called free's allowance "unspendable" and asked for it to be removed or
      // zeroed. That premise predates AF4 going live: `ask_book` and semantic-search
      // synthesis both meter against `ai_budget` and are shipped on BOTH clients, so the
      // allowance is spendable. Removing it would deny free users every metered AI
      // feature — far wider than D3 decided, and it would pre-empt D4.
      const plans = await serviceReading(STORED_OLD_CATALOGUE).getPlans();

      expect(plans[PlanTier.Free].features).toContain(PremiumFeature.AiBudget);
    });

    it('needs no catalogue migration at all — the compiled default already matches', () => {
      // This is why D3 escapes the trap that caught B4's `maxPieces`: `mergePlans` spreads a
      // stored tier's `features` wholesale, so a code-only edit to DEFAULT_PLAN_FEATURES
      // would have been inert on every existing deployment. D3 needs no such edit. The
      // regression is carried entirely by the gate in the usage meter, which is CODE and is
      // therefore live everywhere the moment it deploys — stored catalogue or not.
      expect(DEFAULT_PLAN_FEATURES[PlanTier.Free]).not.toContain(PremiumFeature.AiWriting);
      expect(DEFAULT_PLAN_FEATURES[PlanTier.Free]).toContain(PremiumFeature.AiBudget);
    });
  });

  describe('the paid tiers — the failure that actually hurts', () => {
    it('grants ai_writing on every paid tier as SEEDED, so no seeded deployment denies a payer', async () => {
      // The seeded row is the shipped `monetization.plans` default value, read from the
      // catalogue rather than restated, so this test tracks the real seed if it ever moves.
      const seeded = SETTING_DEFINITION_BY_KEY.get('monetization.plans')?.defaultValue;
      const plans = await serviceReading(seeded).getPlans();

      for (const tier of [PlanTier.Plus, PlanTier.Pro, PlanTier.Enterprise]) {
        expect(plans[tier].features).toContain(PremiumFeature.AiWriting);
      }
    });

    it('reports no drift for a seeded or absent catalogue', async () => {
      await expect(serviceReading(null).auditEnforcedPaidFeatures()).resolves.toEqual([]);
      await expect(
        serviceReading(STORED_OLD_CATALOGUE).auditEnforcedPaidFeatures(),
      ).resolves.toEqual([]);
    });

    it('DETECTS a hand-edited catalogue whose paid tier lost ai_writing', async () => {
      // Not reachable by seeding — `ai_writing` was on plus in the same commit that created
      // the setting. Only an admin edit produces this, and before today it was harmless.
      const handEdited = {
        ...STORED_OLD_CATALOGUE,
        plus: { tier: 'plus', name: 'Plus', features: ['ai_budget', 'premium_search'] },
      };

      await expect(serviceReading(handEdited).auditEnforcedPaidFeatures()).resolves.toEqual([
        { tier: PlanTier.Plus, feature: PremiumFeature.AiWriting },
      ]);
    });

    it('reports and does not repair — the stored value is left exactly as the admin wrote it', async () => {
      // Where the two constraints conflict, the admin's intent wins: a stored array replaces
      // rather than merges, so "stale seed" and "deliberate removal" are indistinguishable
      // by inspection, and healing one would silently overwrite the other.
      const handEdited = {
        ...STORED_OLD_CATALOGUE,
        plus: { tier: 'plus', name: 'Plus', features: ['ai_budget', 'premium_search'] },
      };
      const service = serviceReading(handEdited);

      await service.auditEnforcedPaidFeatures();

      expect((await service.getPlans())[PlanTier.Plus].features).toEqual([
        'ai_budget',
        'premium_search',
      ]);
    });
  });
});

/**
 * The write half of A1-2 (docs/48 §3). `updateConfig` always merged all seven fields per key — the
 * DTO was what withheld three of them, and `dto/monetization-config.dto.spec.ts` now pins that
 * boundary. This pins the other end: given a patch carrying the tables, the value actually SAVED
 * carries them too, merged rather than replaced.
 */
describe('MonetizationConfigService — a config patch persists all seven fields (A1-2)', () => {
  function serviceWriting(stored: unknown) {
    const settings = {
      getValue: jest.fn().mockResolvedValue(stored),
      updateSettings: jest.fn().mockResolvedValue(undefined),
    };
    const service = new MonetizationConfigService(settings as unknown as SettingsService);
    return { service, settings };
  }

  const ACTOR = { id: 'admin-1', role: 'admin' } as never;

  it('saves the three tables, merged per key over what was stored', async () => {
    const { service, settings } = serviceWriting(null);

    const next = await service.updateConfig(
      {
        creditsPerUsd: 1200,
        taxRates: { PK: 0.17 },
        currencyRates: { pkr: 280 },
        regionCurrency: { PK: 'pkr' },
      },
      ACTOR,
    );

    const [rows] = settings.updateSettings.mock.calls[0] as [
      Array<{ key: string; value: unknown }>,
    ];
    expect(rows[0]?.key).toBe('monetization.config');
    expect(rows[0]?.value).toEqual(next);

    expect(next.creditsPerUsd).toBe(1200);
    // Merged, not replaced: the compiled entries survive alongside the new one.
    expect(next.taxRates).toMatchObject({ default: 0, GB: 0.2, PK: 0.17 });
    expect(next.currencyRates).toMatchObject({ usd: 1, gbp: 0.79, pkr: 280 });
    expect(next.regionCurrency).toMatchObject({ US: 'usd', PK: 'pkr' });
  });

  it('leaves every table untouched when the patch names none of them', async () => {
    const { service } = serviceWriting(null);

    const next = await service.updateConfig({ trialDays: 21 }, ACTOR);

    expect(next.trialDays).toBe(21);
    expect(next.taxRates).toEqual(DEFAULT_CONFIG.taxRates);
    expect(next.currencyRates).toEqual(DEFAULT_CONFIG.currencyRates);
    expect(next.regionCurrency).toEqual(DEFAULT_CONFIG.regionCurrency);
  });
});
