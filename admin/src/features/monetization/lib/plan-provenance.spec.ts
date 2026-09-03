import {
  DEFAULT_PLAN_FEATURES,
  DEFAULT_PLAN_LIMITS,
  PlanTier,
  PremiumFeature,
  UNLIMITED_SEATS,
} from '@qalam/shared';
import { describe, expect, it } from 'vitest';

import {
  describeLimit,
  featureDelta,
  featureProvenance,
  isEnforcedCode,
  limitKeysFor,
  sentinelNote,
} from './plan-provenance';

/**
 * The two readings the plan screen must get right (A1a). Both are pinned here rather than through
 * the rendered table because they are pure rules, and because getting either wrong is silent: a
 * mis-rendered sentinel looks like a working screen that states the opposite of what is configured.
 */
describe('describeLimit — the two sentinel conventions', () => {
  it('reads 0 as unlimited on an ordinary key', () => {
    const reading = describeLimit(PlanTier.Pro, { maxPieces: 0 }, 'maxPieces');

    expect(reading.unlimited).toBe(true);
    expect(reading.inverted).toBe(false);
    expect(reading.display).toBe('Unlimited');
  });

  it('reads 0 as NONE on maxCollaborators — the inverted key', () => {
    // The whole reason this file exists. Under the house convention Free's genuine zero seats would
    // render "Unlimited", which is the exact inverse of what B6 sells.
    const reading = describeLimit(PlanTier.Free, { maxCollaborators: 0 }, 'maxCollaborators');

    expect(reading.unlimited).toBe(false);
    expect(reading.inverted).toBe(true);
    expect(reading.display).toBe('None (0)');
    expect(reading.display).not.toContain('Unlimited');
  });

  it('reads -1 as unlimited on maxCollaborators, and keeps the stored number visible', () => {
    const reading = describeLimit(
      PlanTier.Enterprise,
      { maxCollaborators: UNLIMITED_SEATS },
      'maxCollaborators',
    );

    expect(reading.unlimited).toBe(true);
    // The parenthetical is deliberate: an operator about to edit the JSON needs the actual value.
    expect(reading.display).toBe('Unlimited (-1)');
  });

  it('never renders the same number the same way across the two conventions', () => {
    const ordinary = describeLimit(PlanTier.Free, { maxSnapshotHistory: 0 }, 'maxSnapshotHistory');
    const inverted = describeLimit(PlanTier.Free, { maxCollaborators: 0 }, 'maxCollaborators');

    expect(ordinary.display).not.toBe(inverted.display);
  });

  it('keeps maxSnapshotHistory on the ORDINARY convention (B7, not B6)', () => {
    // B7 rides the house sentinel and must not be "fixed" toward B6's inversion.
    const reading = describeLimit(
      PlanTier.Free,
      DEFAULT_PLAN_LIMITS[PlanTier.Free],
      'maxSnapshotHistory',
    );

    expect(reading.inverted).toBe(false);
    expect(reading.display).toBe('5');
  });

  it('formats large token caps readably', () => {
    const reading = describeLimit(PlanTier.Free, { aiMonthlyTokens: 200_000 }, 'aiMonthlyTokens');

    expect(reading.display).toBe((200_000).toLocaleString());
  });
});

describe('sentinelNote — stated inline at every field', () => {
  it('names the inversion on maxCollaborators and calls it the exception', () => {
    const note = sentinelNote('maxCollaborators');

    expect(note).toContain('-1');
    expect(note).toContain('unlimited');
    expect(note).toContain('none');
    expect(note).toContain('exception');
  });

  it('still states the ordinary rule on every other key', () => {
    // A note only on the odd key would make its absence elsewhere read as "no convention here".
    for (const key of ['aiDailyTokens', 'maxPieces', 'maxSnapshotHistory']) {
      expect(sentinelNote(key)).toBe('0 = unlimited.');
    }
  });
});

describe('describeLimit — default vs admin override', () => {
  it('calls a value matching the compiled default a default', () => {
    const compiled = DEFAULT_PLAN_LIMITS[PlanTier.Plus];
    const reading = describeLimit(PlanTier.Plus, compiled, 'maxPieces');

    expect(reading.provenance).toBe('default');
    expect(reading.defaultValue).toBe(compiled.maxPieces);
  });

  it('calls a value that differs an override, and carries the default for comparison', () => {
    const compiled = DEFAULT_PLAN_LIMITS[PlanTier.Plus];
    const reading = describeLimit(PlanTier.Plus, { ...compiled, maxPieces: 999 }, 'maxPieces');

    expect(reading.provenance).toBe('override');
    expect(reading.value).toBe(999);
    expect(reading.defaultValue).toBe(compiled.maxPieces);
  });

  it('treats an absent inverted key as an override, not a silent default', () => {
    // `resolvePlanLimit` resolves an absent inverted key to a hard 0 rather than unlimited, which is
    // NOT what the compiled catalogue ships for a paid tier — so it must not read as "default".
    const reading = describeLimit(PlanTier.Plus, { maxPieces: 250 }, 'maxCollaborators');

    expect(reading.value).toBe(0);
    expect(reading.unlimited).toBe(false);
    expect(reading.provenance).toBe('override');
  });

  it('lists limit keys from the COMPILED catalogue so a deleted key still shows', () => {
    const keys = limitKeysFor(PlanTier.Free);

    expect(keys).toContain('maxCollaborators');
    expect(keys).toContain('maxSnapshotHistory');
    expect(keys).toEqual(Object.keys(DEFAULT_PLAN_LIMITS[PlanTier.Free]));
  });
});

describe('featureProvenance — array granularity, because the merge replaces wholesale', () => {
  it('calls the compiled set a default regardless of order', () => {
    const shuffled = [...DEFAULT_PLAN_FEATURES[PlanTier.Pro]].reverse();

    expect(featureProvenance(PlanTier.Pro, shuffled)).toBe('default');
  });

  it('calls any difference an override', () => {
    expect(featureProvenance(PlanTier.Free, [])).toBe('override');
    // A paid code on the free tier is a difference whatever the free tier happens to ship.
    expect(
      featureProvenance(PlanTier.Free, [
        ...DEFAULT_PLAN_FEATURES[PlanTier.Free],
        PremiumFeature.AiWriting,
      ]),
    ).toBe('override');
  });

  it('reports what was added and removed against the compiled catalogue', () => {
    // Arranged on Plus, and on the catalogue rather than on literal codes: D5 is removing codes
    // from the compiled sets, and a delta test that names one is testing the catalogue's contents
    // instead of the diff. Plus keeps a non-empty set, so `removed` stays a real assertion.
    const stored = [PremiumFeature.AdvancedAnalytics];
    const delta = featureDelta(PlanTier.Plus, stored);

    expect(delta.added).toEqual([PremiumFeature.AdvancedAnalytics]);
    expect(delta.removed).toEqual([...DEFAULT_PLAN_FEATURES[PlanTier.Plus]]);
  });

  it('reports no delta for the compiled set', () => {
    const delta = featureDelta(PlanTier.Plus, DEFAULT_PLAN_FEATURES[PlanTier.Plus]);

    expect(delta.added).toEqual([]);
    expect(delta.removed).toEqual([]);
  });
});

describe('isEnforcedCode — which grants actually do something', () => {
  it('names ai_writing as enforced', () => {
    // `ai_writing` became enforceable on 2026-08-17 (D3). `ai_budget` was the other enforced code
    // until D5 removed the credit economy it guarded; `story_intelligence` joins this list when the
    // admin half of D5 lands.
    expect(isEnforcedCode(PremiumFeature.AiWriting)).toBe(true);
  });

  it('reports D4 codes as unenforced, so a grant is not sold as effective', () => {
    for (const code of [
      PremiumFeature.AiDiscovery,
      PremiumFeature.PremiumSearch,
      PremiumFeature.PremiumRecommendations,
      PremiumFeature.StoryIntelligence,
      PremiumFeature.AdvancedAnalytics,
      PremiumFeature.PublishingPro,
    ]) {
      expect(isEnforcedCode(code)).toBe(false);
    }
  });
});
