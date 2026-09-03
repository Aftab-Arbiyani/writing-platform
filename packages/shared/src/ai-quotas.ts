import { AiFeature, AI_FEATURE_PREMIUM_CODE } from './ai.js';
import { PremiumFeature, QuotaWindow } from './monetization.js';

/**
 * Per-feature allowances (D5) — what a plan actually limits, now that it no longer limits
 * tokens.
 *
 * The token budget it replaces was a bad unit for a writer: nobody knows what 20,000 tokens
 * buys, the number moves with the model, and "you have 3,200 tokens left" answers a question
 * nobody asked. A count of actions does answer it — *you have used 12 of your 30 polishes
 * today* — and it is stable across a model change, which the token cap never was.
 *
 * Tokens and cost do not disappear; they stop being the writer's problem. `ai_usage_logs`
 * still records both and the admin dashboards still read them, so the business keeps its
 * cost signal while the product stops leaking it.
 *
 * This lives in its own module rather than in `ai.ts` or `monetization.ts` because it joins
 * them: `ai.ts` already imports `monetization.ts` for {@link PremiumFeature}, so putting the
 * join in either one would close a cycle between two modules that are both plain `as const`
 * vocabulary.
 */

/** The `PlanLimits` keys that carry a per-feature allowance. */
export const AI_QUOTA_LIMIT_KEYS = {
  PolishActionsPerDay: 'polishActionsPerDay',
  FeedbackReportsPerDay: 'feedbackReportsPerDay',
  StoryAnalysesPerMonth: 'storyAnalysesPerMonth',
} as const;
export type AiQuotaLimitKey = (typeof AI_QUOTA_LIMIT_KEYS)[keyof typeof AI_QUOTA_LIMIT_KEYS];

/** One allowance: which limit key, over what window, covering which AI features. */
export interface AiQuotaRule {
  limitKey: AiQuotaLimitKey;
  window: QuotaWindow;
  /** User-facing name of the thing being counted, singular subject ("Polish"). */
  label: string;
  /** Every AI feature whose requests count against this allowance. */
  features: readonly AiFeature[];
}

/**
 * The allowance table. Ordinary sentinel throughout: **`0` means unlimited**, as it does for
 * `maxPieces` and `maxSnapshotHistory`. `maxCollaborators` is the one key in the codebase
 * that inverts this (`-1` = unlimited, `0` = none) — do not copy that convention here.
 *
 * The five story analyses share ONE allowance because a writer runs them together: "Map this
 * story" is a single user action that spends five of them. Counting them separately would
 * mean five limits nobody can reason about, and a half-mapped story when one of them ran out.
 */
export const AI_QUOTA_RULES: readonly AiQuotaRule[] = [
  {
    limitKey: AI_QUOTA_LIMIT_KEYS.PolishActionsPerDay,
    window: QuotaWindow.Daily,
    label: 'Polish',
    features: [
      AiFeature.WritingAssistant,
      /*
       * `grammar`, `rewrite` and `summarization` are the vestigial AF1 codes: sold behind
       * `ai_writing` but with no caller anywhere, so today they count nothing. They are listed
       * anyway because `uncountedPaidAiFeatures` refuses to let a SOLD feature go uncounted,
       * and it is right to — whoever gives one of them a caller would otherwise ship a
       * capability a plan charges for and no allowance ever limits. They are all edits to
       * text the writer already wrote, so Polish is where they belong. (They go entirely when
       * the client halves stop importing them.)
       */
      AiFeature.Grammar,
      AiFeature.Rewrite,
      AiFeature.Summarization,
    ],
  },
  {
    limitKey: AI_QUOTA_LIMIT_KEYS.FeedbackReportsPerDay,
    window: QuotaWindow.Daily,
    label: 'Manuscript feedback',
    features: [AiFeature.CraftCoach],
  },
  {
    limitKey: AI_QUOTA_LIMIT_KEYS.StoryAnalysesPerMonth,
    window: QuotaWindow.Monthly,
    label: 'Story analyses',
    features: [
      AiFeature.CharacterAnalysis,
      AiFeature.PlotAnalysis,
      AiFeature.WorldBuilding,
      AiFeature.StyleAnalysis,
      AiFeature.StoryTimeline,
    ],
  },
];

/** How many analyses one "Map this story" run spends — the whole story-analysis set. */
export const STORY_MAP_ANALYSIS_COUNT = AI_QUOTA_RULES.find(
  (rule) => rule.limitKey === AI_QUOTA_LIMIT_KEYS.StoryAnalysesPerMonth,
)!.features.length;

/** The allowance an AI feature spends, or `null` when it is not counted. */
export function quotaRuleForAiFeature(feature: AiFeature): AiQuotaRule | null {
  return AI_QUOTA_RULES.find((rule) => rule.features.includes(feature)) ?? null;
}

/**
 * Every AI feature sold behind a premium code must be counted by exactly one rule.
 *
 * Asserted at RUNTIME rather than in the type system, because the interesting direction —
 * "sold but uncounted" — is a relationship between two tables, not a shape a type can pin.
 * The failure it forecloses is a future paid feature shipping with a plan that charges for
 * it and an allowance that never runs out, which is invisible until a bill arrives.
 * `packages/shared` has no test runner (its suite is `tsc`), so the backend's
 * `ai-quotas.spec.ts` is where this actually runs.
 */
export function uncountedPaidAiFeatures(): AiFeature[] {
  return Object.values(AiFeature).filter(
    (feature) =>
      AI_FEATURE_PREMIUM_CODE[feature] !== null && quotaRuleForAiFeature(feature) === null,
  );
}

/**
 * The user-facing name of a premium code — the single place all three clients read it from,
 * so a lock card on web and a lock card on mobile cannot drift into naming the same purchase
 * differently. Unknown codes fall back to the raw value rather than throwing: an admin can
 * grant an override for a code this build has never heard of.
 */
export const PREMIUM_FEATURE_LABELS: Readonly<Record<string, string>> = {
  [PremiumFeature.AiWriting]: 'Polish & feedback',
  [PremiumFeature.StoryIntelligence]: 'Story Map',
  [PremiumFeature.AiDiscovery]: 'Discovery',
  [PremiumFeature.PremiumSearch]: 'Search',
  [PremiumFeature.PremiumRecommendations]: 'Recommendations',
  [PremiumFeature.AdvancedAnalytics]: 'Advanced analytics',
  [PremiumFeature.PublishingPro]: 'Pro publishing',
  [PremiumFeature.Marketplace]: 'Marketplace',
  [PremiumFeature.Collaboration]: 'Collaboration',
  [PremiumFeature.Enterprise]: 'Enterprise',
};

/** {@link PREMIUM_FEATURE_LABELS} with a safe fallback. */
export function premiumFeatureLabel(code: string): string {
  return PREMIUM_FEATURE_LABELS[code] ?? code;
}
