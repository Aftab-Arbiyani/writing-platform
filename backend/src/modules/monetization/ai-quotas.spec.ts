import {
  AI_QUOTA_RULES,
  AiFeature,
  DEFAULT_PLAN_LIMITS,
  NEGATIVE_UNLIMITED_LIMIT_KEYS,
  PLAN_TIER_ORDER,
  PlanTier,
  premiumFeatureLabel,
  PremiumFeature,
  quotaRuleForAiFeature,
  resolvePlanLimit,
  STORY_MAP_ANALYSIS_COUNT,
  uncountedPaidAiFeatures,
} from '@qalam/shared';

import { MONETIZATION_SETTING_KEYS } from './monetization.constants';
import { SETTING_DEFINITION_BY_KEY } from '../settings/settings.catalog';

/**
 * The D5 allowance vocabulary lives in `@qalam/shared`, which has no test runner — its suite
 * is `tsc`. Anything about it that a TYPE cannot express has to be asserted somewhere, and
 * this is that somewhere.
 */
describe('AI quota rules (D5)', () => {
  it('counts every AI feature that a plan sells', () => {
    // The failure this forecloses: a future paid feature ships with a plan that charges for
    // it and an allowance that never runs out — invisible until a provider bill arrives.
    expect(uncountedPaidAiFeatures()).toEqual([]);
  });

  it('assigns each counted feature to exactly one allowance', () => {
    const seen = new Map<AiFeature, number>();
    for (const rule of AI_QUOTA_RULES) {
      for (const feature of rule.features) {
        seen.set(feature, (seen.get(feature) ?? 0) + 1);
      }
    }
    expect([...seen.entries()].filter(([, count]) => count > 1)).toEqual([]);
  });

  it('spends the whole analysis set on one "Map this story" run', () => {
    expect(STORY_MAP_ANALYSIS_COUNT).toBe(5);
    expect(quotaRuleForAiFeature(AiFeature.StoryTimeline)?.limitKey).toBe('storyAnalysesPerMonth');
  });

  it('leaves infrastructure features uncounted', () => {
    expect(quotaRuleForAiFeature(AiFeature.Playground)).toBeNull();
    expect(quotaRuleForAiFeature(AiFeature.Moderation)).toBeNull();
  });

  /**
   * These keys use the ORDINARY sentinel (`0` = unlimited). `maxCollaborators` is the single
   * key in the codebase that inverts it, and a new limit key drifting onto that convention
   * would silently hand every free author an unlimited allowance.
   */
  it('stays on the ordinary unlimited sentinel', () => {
    for (const rule of AI_QUOTA_RULES) {
      expect(NEGATIVE_UNLIMITED_LIMIT_KEYS).not.toContain(rule.limitKey);
      expect(resolvePlanLimit({ [rule.limitKey]: 0 }, rule.limitKey).unlimited).toBe(true);
      expect(resolvePlanLimit({ [rule.limitKey]: 5 }, rule.limitKey)).toEqual({
        value: 5,
        unlimited: false,
      });
    }
  });

  describe('plan catalogue', () => {
    it('gives every tier a value for every allowance', () => {
      for (const tier of PLAN_TIER_ORDER) {
        for (const rule of AI_QUOTA_RULES) {
          expect(DEFAULT_PLAN_LIMITS[tier]).toHaveProperty(rule.limitKey);
        }
      }
    });

    /**
     * The compiled defaults and the seeded settings row are two copies of the same table, and
     * the seeded one is what a fresh deployment actually gets. They drifted before (48 §5.2),
     * which is why this compares them rather than trusting either alone.
     */
    it('seeds the same allowances it compiles', () => {
      const seeded = SETTING_DEFINITION_BY_KEY.get(MONETIZATION_SETTING_KEYS.Plans)
        ?.defaultValue as Record<PlanTier, { limits: Record<string, number> }>;

      for (const tier of PLAN_TIER_ORDER) {
        for (const rule of AI_QUOTA_RULES) {
          expect(seeded[tier].limits[rule.limitKey]).toBe(DEFAULT_PLAN_LIMITS[tier][rule.limitKey]);
        }
      }
    });

    it('grows the allowance with the tier, and ends unlimited', () => {
      for (const rule of AI_QUOTA_RULES) {
        const free = DEFAULT_PLAN_LIMITS[PlanTier.Free][rule.limitKey] as number;
        const plus = DEFAULT_PLAN_LIMITS[PlanTier.Plus][rule.limitKey] as number;
        const pro = DEFAULT_PLAN_LIMITS[PlanTier.Pro][rule.limitKey] as number;

        expect(free).toBeGreaterThan(0);
        expect(plus).toBeGreaterThan(free);
        expect(pro).toBeGreaterThan(plus);
        // Enterprise is 0 = unlimited, which is why this is a sentinel check and not `> pro`.
        expect(
          resolvePlanLimit(DEFAULT_PLAN_LIMITS[PlanTier.Enterprise], rule.limitKey).unlimited,
        ).toBe(true);
      }
    });

    /**
     * Pro's monthly analyses must divide into whole stories. A writer who maps a story spends
     * five at once, so an allowance of, say, 98 would strand three that can never be used.
     */
    it('sizes story analyses in whole stories', () => {
      for (const tier of [PlanTier.Free, PlanTier.Plus, PlanTier.Pro]) {
        const limit = DEFAULT_PLAN_LIMITS[tier].storyAnalysesPerMonth as number;
        expect(limit % STORY_MAP_ANALYSIS_COUNT).toBe(0);
      }
    });
  });

  describe('premium labels', () => {
    it('names the two codes the server actually enforces', () => {
      expect(premiumFeatureLabel(PremiumFeature.AiWriting)).toBe('Polish & feedback');
      expect(premiumFeatureLabel(PremiumFeature.StoryIntelligence)).toBe('Story Map');
    });

    it('says nothing about AI', () => {
      for (const code of Object.values(PremiumFeature)) {
        expect(premiumFeatureLabel(code)).not.toMatch(/\bAI\b/);
      }
    });

    it('falls back to the raw code rather than throwing on an unknown grant', () => {
      expect(premiumFeatureLabel('some_future_code')).toBe('some_future_code');
    });
  });
});
