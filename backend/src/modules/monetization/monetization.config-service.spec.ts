import {
  NEGATIVE_UNLIMITED_LIMIT_KEYS,
  PlanTier,
  UNLIMITED_SEATS,
  resolvePlanLimit,
} from '@qalam/shared';

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
