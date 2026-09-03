import { AiFeature, ERROR_CODES } from '@qalam/shared';
import type { AiFeaturesResponse } from '@qalam/api-types';
import { describe, expect, it } from 'vitest';

import {
  AVAILABILITY_COPY,
  availabilityFromErrorCode,
  resolveAvailability,
} from './ai-availability';

function features(over: Partial<AiFeaturesResponse> = {}): AiFeaturesResponse {
  return {
    aiEnabled: true,
    userAiEnabled: true,
    features: [
      {
        feature: AiFeature.WritingAssistant,
        flagKey: 'feature.ai.writingAssistant.enabled',
        enabled: true,
      },
      { feature: AiFeature.CraftCoach, flagKey: 'feature.ai.craftCoach.enabled', enabled: true },
    ],
    ...over,
  };
}

const feature = AiFeature.WritingAssistant;

describe('resolveAvailability', () => {
  it('is unknown until the flags have loaded (no wall flashes on first paint)', () => {
    expect(resolveAvailability({ feature, features: undefined })).toBe('unknown');
  });

  it('is available when AI is on, the feature is flagged on, and there is allowance left', () => {
    expect(resolveAvailability({ feature, features: features() })).toBe('available');
  });

  it('reports the master switch being off', () => {
    expect(resolveAvailability({ feature, features: features({ aiEnabled: false }) })).toBe('off');
  });

  /**
   * B5's own switch (docs/45 §4.10), as it stands after D5.
   *
   * The distinction this block used to assert — reader-off vs platform-off, `self-off` vs `off` —
   * is gone. It was a real difference with different remedies, and the remedy is what removed it:
   * `self-off`'s copy sent the reader to `/settings/ai`, and D5 deleted that route along with the
   * switch. A state whose whole value is naming an action the writer can take stops earning its
   * keep the moment the action does not exist.
   *
   * What is asserted instead is that the merge is COMPLETE and blames nobody, and that the error
   * code still resolves — the column is inert, not dropped, so a writer who flipped it before D5
   * must get an honest refusal rather than a code that maps to nothing.
   */
  describe('the account’s own switch, after D5 folded it into `off`', () => {
    it('reads a reader-off account as plain off', () => {
      expect(
        resolveAvailability({
          feature,
          features: features({ aiEnabled: false, userAiEnabled: false }),
        }),
      ).toBe('off');
    });

    it('reads a platform-off account as plain off too — the two are now one answer', () => {
      expect(
        resolveAvailability({
          feature,
          features: features({ aiEnabled: false, userAiEnabled: true }),
        }),
      ).toBe('off');
    });

    it('hides a master-switch-only surface too (feature: null skips flags, not this)', () => {
      // Story Map and the editor's toolbar button ask the `null` question. An account with the
      // platform off must lose those as well, or they are stranded entry points.
      expect(
        resolveAvailability({
          feature: null,
          features: features({ aiEnabled: false }),
        }),
      ).toBe('off');
    });

    it('leaves an ordinary writer entirely unaffected — the default is on', () => {
      expect(resolveAvailability({ feature, features: features() })).toBe('available');
    });

    it('still maps AI_DISABLED_BY_USER rather than leaving it unhandled', () => {
      // An unmapped code returns null, which falls back to the pre-flight answer — "available" —
      // so the writer would be invited to retry a request that can only fail again.
      expect(availabilityFromErrorCode(ERROR_CODES.AI_DISABLED_BY_USER)).toBe('off');
      // The distinctness that still matters: three neighbouring codes, three different remedies.
      expect(availabilityFromErrorCode(ERROR_CODES.AI_DISABLED)).toBe('off');
      expect(availabilityFromErrorCode(ERROR_CODES.QUOTA_EXCEEDED)).toBe('quota');
      expect(availabilityFromErrorCode(ERROR_CODES.ENTITLEMENT_DENIED)).toBe('upgrade');
    });

    it('promises nothing it cannot deliver — no settings pointer, no plan, no reset', () => {
      const copy = AVAILABILITY_COPY.off;
      expect(copy.description).not.toMatch(/settings/i);
      expect(copy.description).not.toMatch(/plan/i);
      expect(copy.description).not.toMatch(/reset/i);
    });
  });

  it('distinguishes this feature being dark-launched from the platform being off entirely', () => {
    const flags = features({
      features: [
        {
          feature: AiFeature.WritingAssistant,
          flagKey: 'feature.ai.writingAssistant.enabled',
          enabled: false,
        },
      ],
    });
    expect(resolveAvailability({ feature, features: flags })).toBe('feature-off');
  });

  /**
   * D5 deleted four cases here, all of them about the pre-flight token-window quota: "reports quota
   * when either window is spent", "never reports quota for an unlimited window", "stays available
   * while usage is still loading", and "treats a missing window as not exhausted".
   *
   * They tested a read of `GET /ai/usage/me` that no longer exists, against a token budget that is
   * no longer the writer's unit. `quota` did not disappear with them — it is still reached from the
   * 429, which is asserted below and was always the authoritative half. The pre-flight read was the
   * courtesy, and a courtesy that can be stale is a courtesy that can lie.
   */
  it('never resolves quota up front — only a real refusal can say that', () => {
    expect(resolveAvailability({ feature, features: features() })).toBe('available');
    expect(availabilityFromErrorCode(ERROR_CODES.QUOTA_EXCEEDED)).toBe('quota');
  });

  it('no longer accepts a null-feature surface being walled by another tool’s allowance', () => {
    // Story Map spends nothing to read the graph. It could never resolve to `quota`, and now
    // nothing can resolve to it before a request — which makes that guarantee structural.
    expect(resolveAvailability({ feature: null, features: features() })).toBe('available');
  });
});

describe('availabilityFromErrorCode', () => {
  it('maps both quota codes to the same writer-facing state', () => {
    // A plan cap and the AI module's own token cap are indistinguishable to a writer: they are
    // out of allowance either way.
    expect(availabilityFromErrorCode('QUOTA_EXCEEDED')).toBe('quota');
    expect(availabilityFromErrorCode('AI_USAGE_LIMIT_EXCEEDED')).toBe('quota');
  });

  it('maps the disabled codes', () => {
    expect(availabilityFromErrorCode('AI_DISABLED')).toBe('off');
    expect(availabilityFromErrorCode('AI_FEATURE_DISABLED')).toBe('feature-off');
  });

  /**
   * W4/AF5. The refusal is raised by the monetization meter on the way INTO a generation, and it was
   * unmapped before W4 — unmapped means null, which resolves to the pre-flight answer, "available",
   * so a writer refused saw a generic failure over a panel still inviting them to try again.
   *
   * D5 dropped `INSUFFICIENT_CREDITS` from this case. The meter no longer raises it: B4 removed the
   * credit economy, so nothing debits a wallet and nothing can be short of one. The code itself
   * survives in `@qalam/shared` until Phase V, and is deliberately NOT mapped here — a state that
   * cannot be reached does not need a remedy.
   */
  it('maps the entitlement refusal to the upgrade state', () => {
    expect(availabilityFromErrorCode('ENTITLEMENT_DENIED')).toBe('upgrade');
  });

  it('keeps upgrade distinct from quota, because the remedies differ', () => {
    // An allowance resets on its own and waiting is enough; a denied entitlement never resets and only
    // a plan changes it. Collapsing the two would tell someone to wait for something that never comes.
    expect(availabilityFromErrorCode('ENTITLEMENT_DENIED')).not.toBe(
      availabilityFromErrorCode('QUOTA_EXCEEDED'),
    );
  });

  it('returns null for unrelated failures, leaving the pre-flight state in charge', () => {
    expect(availabilityFromErrorCode('AI_STREAM_ERROR')).toBeNull();
    expect(availabilityFromErrorCode(null)).toBeNull();
  });
});

describe('AVAILABILITY_COPY', () => {
  it('has copy for every blocked state, so no state renders an undefined notice', () => {
    // The notice component indexes this map by state. A new state without an entry would render
    // `undefined.title` — which is why this asserts the whole set rather than one addition.
    for (const state of ['off', 'feature-off', 'quota', 'upgrade'] as const) {
      expect(AVAILABILITY_COPY[state].title).toBeTruthy();
      expect(AVAILABILITY_COPY[state].description).toBeTruthy();
    }
  });

  it('reassures that writing is unaffected in both metering states', () => {
    // A writer hitting a wall mid-draft needs to know their words are safe before anything else.
    expect(AVAILABILITY_COPY.quota.description).toMatch(/writing is unaffected/i);
    expect(AVAILABILITY_COPY.upgrade.description).toMatch(/writing is unaffected/i);
  });
});

/**
 * D3 (docs/45 §4 row D3, docs/48 §6.13) — the writing tools are paid, so ENTITLEMENT_DENIED has two
 * readings and they lead to different places.
 */
describe('D3 — the writing-tools entitlement denial', () => {
  it('reads a denial on a WRITING feature as the writing upgrade', () => {
    for (const feature of [AiFeature.WritingAssistant, AiFeature.CraftCoach]) {
      expect(availabilityFromErrorCode('ENTITLEMENT_DENIED', feature)).toBe('upgrade-writing');
    }
  });

  it('leaves a NON-writing feature on the plain upgrade — its denial is about a different code', () => {
    // The split is by premium CODE, not by "is this an AI thing". A story analysis is denied under
    // `story_intelligence`, so the writing copy would name the wrong plan.
    //
    // D5: this case used to be arranged on the AF4 surfaces (ask / search / recommendations). Those
    // are public or gone, so the arrangement moved to the story kinds — the remaining features whose
    // premium code is not `ai_writing`. The behaviour under test never changed.
    for (const feature of [
      AiFeature.CharacterAnalysis,
      AiFeature.PlotAnalysis,
      AiFeature.StoryTimeline,
    ]) {
      expect(availabilityFromErrorCode('ENTITLEMENT_DENIED', feature)).toBe('upgrade');
    }
  });

  it('keeps W4 behaviour for a caller that names no feature', () => {
    expect(availabilityFromErrorCode('ENTITLEMENT_DENIED')).toBe('upgrade');
    expect(availabilityFromErrorCode('ENTITLEMENT_DENIED', null)).toBe('upgrade');
  });

  /**
   * The distinct-remedy pin. Each way a tool can be refused has a DIFFERENT fix; conflating any two
   * is the W4 defect recorded in 48 §3.6. This asserts the states are distinct AND that the copy
   * tells different stories, because equal-but-identically-worded states would pass a state check
   * and still mislead the writer.
   *
   * **It was a four-way pin until D5 merged `self-off` into `off`.** That merge is exactly the kind
   * of change this test exists to catch, so it is worth being explicit about why it is allowed: the
   * two states differed only in their remedy — "an admin turned this off, wait" versus "you turned
   * this off, here is the switch" — and D5 deleted the switch. Two remedies became one because one
   * of them stopped existing, not because the distinction was collapsed to save code.
   */
  it('keeps every reachable remedy distinct, in state and in copy', () => {
    const states = {
      off: availabilityFromErrorCode('AI_DISABLED'),
      quota: availabilityFromErrorCode('QUOTA_EXCEEDED'),
      writing: availabilityFromErrorCode('ENTITLEMENT_DENIED', AiFeature.WritingAssistant),
    };

    expect(new Set(Object.values(states)).size).toBe(3);
    expect(states).toEqual({ off: 'off', quota: 'quota', writing: 'upgrade-writing' });

    const titles = Object.values(states).map((s) => AVAILABILITY_COPY[s as 'off'].title);
    expect(new Set(titles).size).toBe(3);
  });

  it('folds the user switch into `off` rather than leaving it unmapped', () => {
    // The alternative to merging was dropping the mapping, which would resolve to "available" and
    // invite a writer to retry a request that can only fail.
    expect(availabilityFromErrorCode('AI_DISABLED_BY_USER')).toBe('off');
  });

  it('names a tier and promises nothing it cannot deliver', () => {
    const copy = AVAILABILITY_COPY['upgrade-writing'];

    expect(copy.title).toMatch(/plus/i);
    // D5 decision 9: the writer reads this at the moment something is refused, which is the worst
    // possible place to introduce a word the product does not otherwise use about itself.
    expect(copy.title).not.toMatch(/\bAI\b/);
    expect(copy.description).not.toMatch(/\bAI\b/);
    expect(copy.description).not.toMatch(/allowance/i);
    expect(copy.description).not.toMatch(/reset/i);
    expect(copy.description).not.toMatch(/settings/i);
  });

  /** The whole copy table, in one assertion. */
  it('says "AI" nowhere a writer can read it', () => {
    for (const copy of Object.values(AVAILABILITY_COPY)) {
      expect(copy.title).not.toMatch(/\bAI\b/);
      expect(copy.description).not.toMatch(/\bAI\b/);
    }
  });
});
